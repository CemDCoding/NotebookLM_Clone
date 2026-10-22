import { randomUUID } from 'node:crypto';
import { type SQL, sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import type { Database } from '../db/db.module';
import { chunks, sources } from '../db/schema';
import { RetrievalRepository } from './retrieval.repository';

const USER_ID = randomUUID();
const NOTEBOOK_ID = randomUUID();

interface Query {
  from?: unknown;
  join?: { table: unknown; on: SQL };
  where?: SQL;
  orderBy: SQL[];
  limit?: number;
}

/** Records the parts of the one select the repository builds. */
function fakeDb(rows: unknown[] = []): { db: Database; query: Query } {
  const query: Query = { orderBy: [] };
  const chain = {
    from: (table: unknown) => {
      query.from = table;
      return chain;
    },
    innerJoin: (table: unknown, on: SQL) => {
      query.join = { table, on };
      return chain;
    },
    where: (where: SQL) => {
      query.where = where;
      return chain;
    },
    orderBy: (...order: SQL[]) => {
      query.orderBy = order;
      return chain;
    },
    limit: (limit: number) => {
      query.limit = limit;
      return Promise.resolve(rows);
    },
  };
  const db = { select: () => chain } as unknown as Database;
  return { db, query };
}

function render(fragment: SQL | undefined): { sql: string; params: unknown[] } {
  if (!fragment) {
    throw new Error('Expected an SQL fragment');
  }
  return new PgDialect().sqlToQuery(sql`${fragment}`);
}

describe('RetrievalRepository', () => {
  it('searches only chunks of the own notebook from active, ready sources', async () => {
    const { db, query } = fakeDb();

    await new RetrievalRepository(db).search(USER_ID, NOTEBOOK_ID, [0.1, 0.2], 8);

    expect(query.from).toBe(chunks);
    expect(query.join?.table).toBe(sources);
    expect(render(query.join?.on).sql).toBe('"sources"."id" = "chunks"."source_id"');

    const where = render(query.where);
    expect(where.sql).toBe(
      '("chunks"."user_id" = $1 and "chunks"."notebook_id" = $2 and ' +
        '("sources"."user_id" = $3 and "sources"."notebook_id" = $4 and ' +
        '"sources"."is_active" = $5 and "sources"."status" = $6))',
    );
    expect(where.params).toEqual([USER_ID, NOTEBOOK_ID, USER_ID, NOTEBOOK_ID, true, 'ready']);
  });

  it('orders by cosine distance, then by chunk ID, and limits to k', async () => {
    const { db, query } = fakeDb();

    await new RetrievalRepository(db).search(USER_ID, NOTEBOOK_ID, [0.1, 0.2], 8);

    const order = query.orderBy.map((part) => render(part));
    expect(order[0]).toMatchObject({ sql: '"chunks"."embedding" <=> $1', params: ['[0.1,0.2]'] });
    expect(order[1]?.sql).toBe('"chunks"."id" asc');
    expect(query.limit).toBe(8);
  });

  it('checks for usable sources with the same filter', async () => {
    const { db, query } = fakeDb([{ id: randomUUID() }]);

    await expect(
      new RetrievalRepository(db).hasReadyActiveSources(USER_ID, NOTEBOOK_ID),
    ).resolves.toBe(true);

    expect(query.from).toBe(sources);
    expect(render(query.where).params).toEqual([USER_ID, NOTEBOOK_ID, true, 'ready']);
    expect(query.limit).toBe(1);
  });

  it('reports a notebook without usable sources', async () => {
    const { db } = fakeDb([]);

    await expect(
      new RetrievalRepository(db).hasReadyActiveSources(USER_ID, NOTEBOOK_ID),
    ).resolves.toBe(false);
  });
});
