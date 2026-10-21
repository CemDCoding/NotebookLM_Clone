import { describe, expect, it } from 'vitest';
import {
  DEMO_NOTEBOOK_TITLE,
  type DemoNotebookRepository,
  type DemoUserAdmin,
  seedDemoAccount,
} from './demo-seed';

const EMAIL = 'demo@example.test';
const PASSWORD = 'initial-password';

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

class FakeNotebooks implements DemoNotebookRepository {
  rows: { id: string; userId: string; title: string }[] = [];
  private nextId = 1;

  add(userId: string, title: string): void {
    this.rows.push({ id: `nb-${this.nextId++}`, userId, title });
  }

  replaceAll(userId: string, title: string) {
    const deletedIds = this.rows.filter((row) => row.userId === userId).map((row) => row.id);
    this.rows = this.rows.filter((row) => row.userId !== userId);
    this.add(userId, title);
    return Promise.resolve({ deletedIds, createdId: `nb-${this.nextId - 1}` });
  }

  titlesOf(userId: string): string[] {
    return this.rows.filter((row) => row.userId === userId).map((row) => row.title);
  }
}

function setup() {
  const users = new FakeUserAdmin();
  const notebooks = new FakeNotebooks();
  const messages: string[] = [];
  const deps = { users, notebooks, logger: { log: (message: string) => messages.push(message) } };
  return { users, notebooks, messages, deps };
}

describe('seedDemoAccount', () => {
  it('creates the user and the demo notebook when the user does not exist', async () => {
    const { users, notebooks, deps } = setup();

    const result = await seedDemoAccount({ email: EMAIL, password: PASSWORD }, deps);

    expect(result).toMatchObject({ userId: 'user-1', userCreated: true, deletedNotebookCount: 0 });
    expect(users.users).toEqual([{ id: 'user-1', email: EMAIL, password: PASSWORD }]);
    expect(notebooks.titlesOf('user-1')).toEqual([DEMO_NOTEBOOK_TITLE]);
  });

  it('reuses an existing user, resets a changed password and replaces its notebooks', async () => {
    const { users, notebooks, deps } = setup();
    users.users.push({ id: 'existing', email: EMAIL, password: 'changed-by-a-reviewer' });
    notebooks.add('existing', 'Eigenes Notebook');
    notebooks.add('existing', DEMO_NOTEBOOK_TITLE);
    notebooks.add('someone-else', 'Fremdes Notebook');

    const result = await seedDemoAccount({ email: EMAIL, password: PASSWORD }, deps);

    expect(result).toMatchObject({
      userId: 'existing',
      userCreated: false,
      deletedNotebookCount: 2,
    });
    expect(users.created).toBe(0);
    expect(users.users[0]?.password).toBe(PASSWORD);
    expect(notebooks.titlesOf('existing')).toEqual([DEMO_NOTEBOOK_TITLE]);
    expect(notebooks.titlesOf('someone-else')).toEqual(['Fremdes Notebook']);
  });

  it('yields the same state when run twice', async () => {
    const { users, notebooks, deps } = setup();

    await seedDemoAccount({ email: EMAIL, password: PASSWORD }, deps);
    const snapshot = { users: structuredClone(users.users), titles: notebooks.titlesOf('user-1') };
    const second = await seedDemoAccount({ email: EMAIL, password: PASSWORD }, deps);

    expect(second.userCreated).toBe(false);
    expect(second.deletedNotebookCount).toBe(1);
    expect(users.users).toEqual(snapshot.users);
    expect(notebooks.titlesOf('user-1')).toEqual(snapshot.titles);
  });

  it('never logs the email or the password', async () => {
    const { users, messages, deps } = setup();
    users.users.push({ id: 'existing', email: EMAIL, password: 'old' });

    await seedDemoAccount({ email: EMAIL, password: PASSWORD }, deps);
    await seedDemoAccount({ email: 'new@example.test', password: 'other-secret' }, deps);

    const log = messages.join('\n');
    expect(log).toContain('existing');
    for (const secret of [EMAIL, PASSWORD, 'new@example.test', 'other-secret']) {
      expect(log).not.toContain(secret);
    }
  });
});
