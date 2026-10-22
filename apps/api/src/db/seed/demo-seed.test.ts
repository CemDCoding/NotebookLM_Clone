import { describe, expect, it } from 'vitest';
import {
  DEMO_NOTEBOOK_TITLE,
  type DemoNotebookRepository,
  type DemoQueue,
  type DemoSampleSource,
  type DemoSourceRepository,
  type DemoStorage,
  type DemoUserAdmin,
  type NewDemoSource,
  seedDemoAccount,
} from './demo-seed';

const EMAIL = 'demo@example.test';
const PASSWORD = 'initial-password';
const CREDENTIALS = { email: EMAIL, password: PASSWORD };
const SAMPLE: DemoSampleSource = {
  type: 'markdown',
  title: 'Beispielquelle',
  contentType: 'text/markdown; charset=utf-8',
  content: Buffer.from('# Beispiel\n\nInhalt der Beispielquelle.\n', 'utf8'),
};
const INPUT = { credentials: CREDENTIALS, sampleSource: SAMPLE };

interface FakeUser {
  id: string;
  email: string;
  password: string;
}

class FakeUserAdmin implements DemoUserAdmin {
  readonly users: FakeUser[] = [];
  created = 0;

  findUserIdByEmail(email: string): Promise<string | null> {
    return Promise.resolve(this.users.find((user) => user.email === email)?.id ?? null);
  }

  createUser(email: string, password: string): Promise<string> {
    this.created++;
    const id = `user-${this.created}`;
    this.users.push({ id, email, password });
    return Promise.resolve(id);
  }

  resetPassword(userId: string, password: string): Promise<void> {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (!user) throw new Error('unknown user');
    user.password = password;
    return Promise.resolve();
  }
}

/**
 * Notebooks and sources in one fake, so deleting a notebook cascades to its
 * sources like the foreign key does.
 */
class FakeDatabase implements DemoNotebookRepository, DemoSourceRepository {
  notebooks: { id: string; userId: string; title: string }[] = [];
  sources: (NewDemoSource & { status: 'pending' })[] = [];
  private nextId = 1;

  addNotebook(userId: string, title: string): string {
    const id = `nb-${this.nextId++}`;
    this.notebooks.push({ id, userId, title });
    return id;
  }

  replaceAll(userId: string, title: string) {
    const deletedIds = this.notebooks.filter((row) => row.userId === userId).map((row) => row.id);
    this.notebooks = this.notebooks.filter((row) => row.userId !== userId);
    this.sources = this.sources.filter((row) => !deletedIds.includes(row.notebookId));
    const createdId = this.addNotebook(userId, title);
    return Promise.resolve({ deletedIds, createdId });
  }

  createPending(source: NewDemoSource): Promise<void> {
    if (!this.notebooks.some((row) => row.id === source.notebookId)) {
      throw new Error('foreign key violation');
    }
    this.sources.push({ ...source, status: 'pending' });
    return Promise.resolve();
  }

  titlesOf(userId: string): string[] {
    return this.notebooks.filter((row) => row.userId === userId).map((row) => row.title);
  }

  sourcesOf(userId: string) {
    return this.sources.filter((row) => row.userId === userId);
  }
}

class FakeStorage implements DemoStorage {
  /** Objects by path `{userId}/{sourceId}`. */
  readonly files = new Map<string, { content: Buffer; contentType: string }>();

  removeAllForUser(userId: string): Promise<void> {
    for (const path of [...this.files.keys()]) {
      if (path.startsWith(`${userId}/`)) this.files.delete(path);
    }
    return Promise.resolve();
  }

  upload(userId: string, sourceId: string, content: Buffer, contentType: string): Promise<void> {
    const path = `${userId}/${sourceId}`;
    if (this.files.has(path)) throw new Error('object exists');
    this.files.set(path, { content, contentType });
    return Promise.resolve();
  }

  pathsOf(userId: string): string[] {
    return [...this.files.keys()].filter((path) => path.startsWith(`${userId}/`));
  }
}

class FakeQueue implements DemoQueue {
  readonly jobs: { sourceId: string; userId: string }[] = [];

  enqueueIngestion(sourceId: string, userId: string): Promise<void> {
    this.jobs.push({ sourceId, userId });
    return Promise.resolve();
  }
}

function setup() {
  const users = new FakeUserAdmin();
  const db = new FakeDatabase();
  const storage = new FakeStorage();
  const queue = new FakeQueue();
  const messages: string[] = [];
  const deps = {
    users,
    notebooks: db,
    sources: db,
    storage,
    queue,
    logger: { log: (message: string) => messages.push(message) },
  };
  return { users, db, storage, queue, messages, deps };
}

describe('seedDemoAccount', () => {
  it('creates the user, the demo notebook and the sample source when the user does not exist', async () => {
    const { users, db, storage, queue, deps } = setup();

    const result = await seedDemoAccount(INPUT, deps);

    expect(result).toMatchObject({ userId: 'user-1', userCreated: true, deletedNotebookCount: 0 });
    expect(users.users).toEqual([{ id: 'user-1', email: EMAIL, password: PASSWORD }]);
    expect(db.titlesOf('user-1')).toEqual([DEMO_NOTEBOOK_TITLE]);
    expect(db.sourcesOf('user-1')).toEqual([
      {
        id: result.sourceId,
        notebookId: result.notebookId,
        userId: 'user-1',
        type: 'markdown',
        title: SAMPLE.title,
        status: 'pending',
      },
    ]);
    expect(storage.files.get(`user-1/${result.sourceId}`)).toEqual({
      content: SAMPLE.content,
      contentType: SAMPLE.contentType,
    });
    expect(queue.jobs).toEqual([{ sourceId: result.sourceId, userId: 'user-1' }]);
  });

  it('reuses an existing user, resets a changed password and replaces its notebooks and files', async () => {
    const { users, db, storage, deps } = setup();
    users.users.push({ id: 'existing', email: EMAIL, password: 'changed-by-a-reviewer' });
    db.addNotebook('existing', 'Eigenes Notebook');
    db.addNotebook('existing', DEMO_NOTEBOOK_TITLE);
    db.addNotebook('someone-else', 'Fremdes Notebook');
    await storage.upload('existing', 'uploaded-by-a-reviewer', Buffer.from('x'), 'text/plain');
    await storage.upload('someone-else', 'foreign-file', Buffer.from('y'), 'text/plain');

    const result = await seedDemoAccount(INPUT, deps);

    expect(result).toMatchObject({
      userId: 'existing',
      userCreated: false,
      deletedNotebookCount: 2,
    });
    expect(users.created).toBe(0);
    expect(users.users[0]?.password).toBe(PASSWORD);
    expect(db.titlesOf('existing')).toEqual([DEMO_NOTEBOOK_TITLE]);
    expect(db.titlesOf('someone-else')).toEqual(['Fremdes Notebook']);
    expect(storage.pathsOf('existing')).toEqual([`existing/${result.sourceId}`]);
    expect(storage.pathsOf('someone-else')).toEqual(['someone-else/foreign-file']);
  });

  it('clears storage before replacing the notebooks, and enqueues only after the row exists', async () => {
    const { users, db, storage, queue, deps } = setup();
    users.users.push({ id: 'existing', email: EMAIL, password: PASSWORD });
    const order: string[] = [];
    const record =
      <A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) =>
      (...args: A) => {
        order.push(name);
        return fn(...args);
      };

    await seedDemoAccount(INPUT, {
      ...deps,
      storage: {
        removeAllForUser: record('removeAllForUser', storage.removeAllForUser.bind(storage)),
        upload: record('upload', storage.upload.bind(storage)),
      },
      notebooks: { replaceAll: record('replaceAll', db.replaceAll.bind(db)) },
      sources: { createPending: record('createPending', db.createPending.bind(db)) },
      queue: { enqueueIngestion: record('enqueueIngestion', queue.enqueueIngestion.bind(queue)) },
    });

    expect(order).toEqual([
      'removeAllForUser',
      'replaceAll',
      'upload',
      'createPending',
      'enqueueIngestion',
    ]);
  });

  it('yields the same state when run twice', async () => {
    const { users, db, storage, queue, deps } = setup();

    await seedDemoAccount(INPUT, deps);
    const snapshot = {
      users: structuredClone(users.users),
      titles: db.titlesOf('user-1'),
      sourceCount: db.sourcesOf('user-1').length,
      fileCount: storage.pathsOf('user-1').length,
    };
    const second = await seedDemoAccount(INPUT, deps);

    expect(second.userCreated).toBe(false);
    expect(second.deletedNotebookCount).toBe(1);
    expect(users.users).toEqual(snapshot.users);
    expect(db.titlesOf('user-1')).toEqual(snapshot.titles);
    expect(db.sourcesOf('user-1')).toHaveLength(snapshot.sourceCount);
    expect(db.sourcesOf('user-1')[0]?.id).toBe(second.sourceId);
    expect(storage.pathsOf('user-1')).toEqual([`user-1/${second.sourceId}`]);
    expect(storage.pathsOf('user-1')).toHaveLength(snapshot.fileCount);
    expect(queue.jobs.at(-1)).toEqual({ sourceId: second.sourceId, userId: 'user-1' });
  });

  it('never logs the email, the password or the sample content', async () => {
    const { users, messages, deps } = setup();
    users.users.push({ id: 'existing', email: EMAIL, password: 'old' });

    const result = await seedDemoAccount(INPUT, deps);
    await seedDemoAccount(
      {
        credentials: { email: 'new@example.test', password: 'other-secret' },
        sampleSource: SAMPLE,
      },
      deps,
    );

    const log = messages.join('\n');
    expect(log).toContain('existing');
    expect(log).toContain(result.sourceId);
    for (const secret of [
      EMAIL,
      PASSWORD,
      'new@example.test',
      'other-secret',
      'Inhalt der Beispielquelle',
    ]) {
      expect(log).not.toContain(secret);
    }
  });
});
