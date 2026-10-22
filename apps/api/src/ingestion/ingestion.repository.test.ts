import { randomUUID } from 'node:crypto';
import { type SQL, sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import type { Database } from '../db/db.module';
import { chunks, sources } from '../db/schema';
import { type EmbeddedChunk, IngestionRepository } from './ingestion.repository';

const USER_ID = randomUUID();
const SOURCE = { id: randomUUID(), notebookId: randomUUID(), type: 'text' as const };

type Operation =
  | { kind: 'select' | 'update' | 'delete'; table: unknown; where: SQL; values?: unknown }
  | { kind: 'insert'; table: unknown; rows: unknown[] };

/**
 * Records the Drizzle calls the repository makes. Updates return
 * `updatedRows` rows, so a test can play a deleted source.
 */
function fakeDb(updatedRows: number): { db: Database; operations: Operation[] } {
  const operations: Operation[] = [];
  const rows = Array.from({ length: updatedRows }, () => ({ ...SOURCE }));
  const builder = {
    select: () => ({
      from: (table: unknown) => ({
        where: (where: SQL) => {
          operations.push({ kind: 'select', table, where });
          return Promise.resolve(rows);
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: (where: SQL) => ({
          returning: () => {
            operations.push({ kind: 'update', table, where, values });
            return Promise.resolve(rows);
          },
        }),
      }),
    }),
    delete: (table: unknown) => ({
      where: (where: SQL) => {
        operations.push({ kind: 'delete', table, where });
        return Promise.resolve();
      },
    }),
    insert: (table: unknown) => ({
      values: (inserted: unknown[]) => {
        operations.push({ kind: 'insert', table, rows: inserted });
        return Promise.resolve();
      },
    }),
  };
  const db = {
    ...builder,
    transaction: <T>(work: (tx: typeof builder) => Promise<T>) => work(builder),
  } as unknown as Database;
  return { db, operations };
}

function render(where: SQL): { sql: string; params: unknown[] } {
  return new PgDialect().sqlToQuery(sql`${where}`);
}

function embedded(count: number): EmbeddedChunk[] {
  return Array.from({ length: count }, (_, position) => ({
    content: `Abschnitt ${position}`,
    page: null,
    position,
    embedding: [position],
  }));
}

describe('IngestionRepository', () => {
  it('filters every source query by the source and the user from the payload', async () => {
    const { db, operations } = fakeDb(1);
    const repository = new IngestionRepository(db);

    await repository.findSource(USER_ID, SOURCE.id);
    await repository.markProcessing(USER_ID, SOURCE.id);
    await repository.markFailed(USER_ID, SOURCE.id, 'Meldung');

    expect(operations).toHaveLength(3);
    for (const operation of operations) {
      expect(operation.table).toBe(sources);
      const query = 'where' in operation ? render(operation.where) : undefined;
      expect(query?.sql).toBe('("sources"."id" = $1 and "sources"."user_id" = $2)');
      expect(query?.params).toEqual([SOURCE.id, USER_ID]);
    }
  });

  it('sets the status and clears or stores the error', async () => {
    const { db, operations } = fakeDb(1);
    const repository = new IngestionRepository(db);

    await expect(repository.markProcessing(USER_ID, SOURCE.id)).resolves.toEqual(SOURCE);
    await expect(repository.markFailed(USER_ID, SOURCE.id, 'Meldung')).resolves.toBe(true);

    expect(operations.map((operation) => 'values' in operation && operation.values)).toEqual([
      { status: 'processing', error: null },
      { status: 'failed', error: 'Meldung' },
    ]);
  });

  it('reports a missing source', async () => {
    const repository = new IngestionRepository(fakeDb(0).db);

    await expect(repository.markProcessing(USER_ID, SOURCE.id)).resolves.toBeUndefined();
    await expect(repository.markFailed(USER_ID, SOURCE.id, 'Meldung')).resolves.toBe(false);
  });

  it('marks the source ready, deletes its old chunks of this user and inserts the new ones', async () => {
    const { db, operations } = fakeDb(1);

    await expect(
      new IngestionRepository(db).replaceChunks(USER_ID, SOURCE, embedded(2)),
    ).resolves.toBe(true);

    expect(operations.map((operation) => operation.kind)).toEqual(['update', 'delete', 'insert']);
    const [update, remove, insert] = operations;
    expect(update).toMatchObject({ table: sources, values: { status: 'ready', error: null } });
    expect(remove?.table).toBe(chunks);
    if (remove?.kind === 'delete') {
      const query = render(remove.where);
      expect(query.sql).toBe('("chunks"."source_id" = $1 and "chunks"."user_id" = $2)');
      expect(query.params).toEqual([SOURCE.id, USER_ID]);
    }
    expect(insert).toEqual({
      kind: 'insert',
      table: chunks,
      rows: embedded(2).map((chunk) => ({
        ...chunk,
        sourceId: SOURCE.id,
        notebookId: SOURCE.notebookId,
        userId: USER_ID,
      })),
    });
  });

  it('inserts large sources in batches', async () => {
    const { db, operations } = fakeDb(1);

    await new IngestionRepository(db).replaceChunks(USER_ID, SOURCE, embedded(250));

    const inserts = operations.filter((operation) => operation.kind === 'insert');
    expect(inserts.map((operation) => operation.rows.length)).toEqual([100, 100, 50]);
  });

  it('writes no chunks if the source no longer exists', async () => {
    const { db, operations } = fakeDb(0);

    await expect(
      new IngestionRepository(db).replaceChunks(USER_ID, SOURCE, embedded(2)),
    ).resolves.toBe(false);

    expect(operations.map((operation) => operation.kind)).toEqual(['update']);
  });
});
