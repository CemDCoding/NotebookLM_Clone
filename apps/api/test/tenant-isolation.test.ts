import { drizzle } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import { describe, expect, it } from 'vitest';
import { AccountRepository } from '../src/account/account.repository';
import { ChatRepository } from '../src/chat/chat.repository';
import type { Database } from '../src/db/db.module';
import * as schema from '../src/db/schema';
import { DrizzleDemoNotebooks } from '../src/db/seed/drizzle-demo-notebooks';
import { DrizzleDemoSources } from '../src/db/seed/drizzle-demo-sources';
import { IngestionRepository } from '../src/ingestion/ingestion.repository';
import { LimitsRepository } from '../src/limits/limits.repository';
import { SourceCountsRepository } from '../src/limits/source-counts.repository';
import { UsageEventsRepository } from '../src/limits/usage-events.repository';
import { NotebooksRepository } from '../src/notebooks/notebooks.repository';
import { RetrievalRepository } from '../src/retrieval/retrieval.repository';
import { SourcesRepository } from '../src/sources/sources.repository';

// Central proof of the tenant rule (CLAUDE.md section 7, apps/api/CLAUDE.md
// "Struktur"): every query of every repository filters by the signed-in
// user's ID. The real repositories run against a Drizzle client whose
// connection only records the generated SQL, so the check covers exactly the
// statements Postgres would receive, without a database.
//
// Deliberately not covered, because they are global by design: the global
// daily counts of `UsageEventsRepository.countSince` without a user, the
// retention cleanup of `usage_events` (CLAUDE.md section 4), the advisory
// locks of `LimitTransactions` and the `select 1` of the health check.

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const NOTEBOOK = '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d';
const SOURCE = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';
const CHUNK = '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b';
// What the fake connection answers for every column of every row.
const ROW_VALUE = '00000000-0000-4000-8000-000000000000';

interface RecordedQuery {
  sql: string;
  params: readonly unknown[];
}

/**
 * A Drizzle client on a fake postgres.js connection. Every statement is
 * recorded and answered with one row, so code paths after a first query
 * (e.g. inside a transaction) run as well.
 */
function recordingDatabase(): { db: Database; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const unsafe = (sql: string, params: readonly unknown[] = []) => {
    queries.push({ sql, params });
    return Object.assign(Promise.resolve([{ count: '0' }]), {
      values: () => Promise.resolve([[ROW_VALUE, ROW_VALUE, ROW_VALUE, ROW_VALUE]]),
    });
  };
  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe,
    begin: (work: (tx: unknown) => Promise<unknown>) => work(client),
  };
  return { db: drizzle(client as unknown as Sql, { schema }), queries };
}

const TABLE_REFERENCE = /\b(?:from|join|update)\s+"(\w+)"/gi;

/**
 * The tables of a statement that are not filtered by the user. A table counts
 * as filtered if its `user_id` is compared with the user's ID parameter, or
 * with the `user_id` of another table (a correlated subquery). An insert must
 * write the user's ID.
 */
function unfilteredTables({ sql, params }: RecordedQuery): string[] {
  const userParams = params.flatMap((value, index) => (value === USER ? [`$${index + 1}`] : []));

  const insert = /^insert into "(\w+)"/i.exec(sql);
  if (insert) {
    return /"user_id"/.test(sql) && userParams.length > 0 ? [] : [insert[1] ?? sql];
  }

  const tables = [...new Set([...sql.matchAll(TABLE_REFERENCE)].map((match) => match[1] ?? ''))];
  return tables.filter((table) => {
    const comparisons = sql.matchAll(
      new RegExp(`"${table}"\\."user_id" = (\\$\\d+|"\\w+"\\."user_id")`, 'g'),
    );
    return ![...comparisons].some(
      ([, operand]) =>
        operand !== undefined && (userParams.includes(operand) || operand.startsWith('"')),
    );
  });
}

type RepositoryCall = (db: Database) => Promise<unknown>;

const embedded = [{ content: 'Abschnitt', page: 1, position: 0, embedding: [0.1, 0.2] }];
const answer = {
  content: 'Antwort',
  createdAt: new Date(),
  model: 'mistral-small-latest',
  citations: [],
};

const CALLS: Record<string, RepositoryCall> = {
  'AccountRepository.readAll': (db) => new AccountRepository(db).readAll(USER),

  'NotebooksRepository.list': (db) => new NotebooksRepository(db).list(USER),
  'NotebooksRepository.findById': (db) => new NotebooksRepository(db).findById(USER, NOTEBOOK),
  'NotebooksRepository.create': (db) => new NotebooksRepository(db).create(USER, 'Titel'),
  'NotebooksRepository.rename': (db) => new NotebooksRepository(db).rename(USER, NOTEBOOK, 'Neu'),
  'NotebooksRepository.delete': (db) => new NotebooksRepository(db).delete(USER, NOTEBOOK),

  'SourcesRepository.notebookExists': (db) =>
    new SourcesRepository(db).notebookExists(USER, NOTEBOOK),
  'SourcesRepository.list': (db) => new SourcesRepository(db).list(USER, NOTEBOOK),
  'SourcesRepository.listIds': (db) => new SourcesRepository(db).listIds(USER, NOTEBOOK),
  'SourcesRepository.findById': (db) => new SourcesRepository(db).findById(USER, NOTEBOOK, SOURCE),
  'SourcesRepository.create': (db) =>
    new SourcesRepository(db).create({
      id: SOURCE,
      notebookId: NOTEBOOK,
      userId: USER,
      type: 'text',
      title: 'Quelle',
      storagePath: `${USER}/${SOURCE}`,
    }),
  'SourcesRepository.setActive': (db) =>
    new SourcesRepository(db).setActive(USER, NOTEBOOK, SOURCE, false),
  'SourcesRepository.delete': (db) => new SourcesRepository(db).delete(USER, NOTEBOOK, SOURCE),

  'ChatRepository.notebookExists': (db) => new ChatRepository(db).notebookExists(USER, NOTEBOOK),
  'ChatRepository.list': (db) => new ChatRepository(db).list(USER, NOTEBOOK),
  'ChatRepository.listRecent': (db) => new ChatRepository(db).listRecent(USER, NOTEBOOK, 6),
  'ChatRepository.saveExchange': (db) =>
    new ChatRepository(db).saveExchange(
      USER,
      NOTEBOOK,
      { content: 'Frage', createdAt: new Date() },
      answer,
    ),
  'ChatRepository.deleteAll': (db) => new ChatRepository(db).deleteAll(USER, NOTEBOOK),
  'ChatRepository.findSections': (db) =>
    new ChatRepository(db).findSections(USER, NOTEBOOK, [CHUNK]),

  'RetrievalRepository.search': (db) =>
    new RetrievalRepository(db).search(USER, NOTEBOOK, [0.1, 0.2], 8),
  'RetrievalRepository.hasReadyActiveSources': (db) =>
    new RetrievalRepository(db).hasReadyActiveSources(USER, NOTEBOOK),

  'IngestionRepository.findSource': (db) => new IngestionRepository(db).findSource(USER, SOURCE),
  'IngestionRepository.markProcessing': (db) =>
    new IngestionRepository(db).markProcessing(USER, SOURCE),
  'IngestionRepository.markFailed': (db) =>
    new IngestionRepository(db).markFailed(USER, SOURCE, 'Fehler'),
  'IngestionRepository.replaceChunks': (db) =>
    new IngestionRepository(db).replaceChunks(
      USER,
      { id: SOURCE, notebookId: NOTEBOOK, type: 'text' },
      embedded,
    ),

  'LimitsRepository.countNotebooks': (db) => new LimitsRepository(db).countNotebooks(USER),
  // These run on the caller's transaction, as inside `LimitTransactions`.
  'SourceCountsRepository.countSources': (db) =>
    db.transaction((tx) => new SourceCountsRepository().countSources(tx, USER, NOTEBOOK)),
  'UsageEventsRepository.countSince (per user)': (db) =>
    db.transaction((tx) => new UsageEventsRepository().countSince(tx, 'chat', new Date(), USER)),
  'UsageEventsRepository.insert': (db) =>
    db.transaction((tx) => new UsageEventsRepository().insert(tx, 'chat', USER)),

  'DrizzleDemoNotebooks.replaceAll': (db) => new DrizzleDemoNotebooks(db).replaceAll(USER, 'Demo'),
  'DrizzleDemoSources.createPending': (db) =>
    new DrizzleDemoSources(db).createPending({
      id: SOURCE,
      notebookId: NOTEBOOK,
      userId: USER,
      type: 'markdown',
      title: 'Beispiel',
    }),
};

const REPOSITORIES: (abstract new (...args: never[]) => object)[] = [
  NotebooksRepository,
  SourcesRepository,
  ChatRepository,
  RetrievalRepository,
  IngestionRepository,
  LimitsRepository,
  SourceCountsRepository,
  UsageEventsRepository,
  DrizzleDemoNotebooks,
  DrizzleDemoSources,
];

// Helpers that only build parts of a statement; their output is checked
// through the public methods that use them.
const PRIVATE_HELPERS = new Set([
  'NotebooksRepository.columnsWithSourceCount',
  'NotebooksRepository.countSources',
]);

describe('Tenant isolation of all repositories', () => {
  it('covers every method of every repository', () => {
    const methods = REPOSITORIES.flatMap((repository) =>
      Object.getOwnPropertyNames(repository.prototype)
        .filter((name) => name !== 'constructor')
        .map((name) => `${repository.name}.${name}`),
    ).filter((method) => !PRIVATE_HELPERS.has(method));
    const covered = new Set(Object.keys(CALLS).map((name) => name.split(' ')[0]));

    expect(methods.filter((method) => !covered.has(method))).toEqual([]);
  });

  describe.each(Object.entries(CALLS))('%s', (_name, call) => {
    it("filters every statement by the user's ID", async () => {
      const { db, queries } = recordingDatabase();

      // Results are irrelevant here; a method may reject the fake rows.
      await call(db).catch(() => undefined);

      expect(queries.length).toBeGreaterThan(0);
      expect(
        queries.map((query) => ({ sql: query.sql, unfiltered: unfilteredTables(query) })),
      ).toEqual(queries.map((query) => ({ sql: query.sql, unfiltered: [] })));
    });
  });

  // The check itself must catch a missing filter, or every case above passes vacuously.
  describe('unfilteredTables', () => {
    it('reports a select without a user filter', () => {
      expect(
        unfilteredTables({
          sql: 'select "id" from "notebooks" where "notebooks"."id" = $1',
          params: [NOTEBOOK],
        }),
      ).toEqual(['notebooks']);
    });

    it('reports a join whose second table is not filtered', () => {
      expect(
        unfilteredTables({
          sql: 'select "chunks"."id" from "chunks" inner join "sources" on "sources"."id" = "chunks"."source_id" where "chunks"."user_id" = $1',
          params: [USER],
        }),
      ).toEqual(['sources']);
    });

    it("reports a filter on another user's ID", () => {
      expect(
        unfilteredTables({
          sql: 'delete from "messages" where "messages"."user_id" = $1',
          params: [ROW_VALUE],
        }),
      ).toEqual(['messages']);
    });

    it("reports an insert without the user's ID", () => {
      expect(
        unfilteredTables({ sql: 'insert into "notebooks" ("title") values ($1)', params: ['x'] }),
      ).toEqual(['notebooks']);
    });
  });
});
