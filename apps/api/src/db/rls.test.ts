import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from './schema';

// Defense in depth (CLAUDE.md section 7): every table has Row Level Security
// switched on and no policy, so the public Supabase API with the anon key
// reaches no row. Only the API's own connection, which bypasses RLS, can read.

const MIGRATIONS_DIR = join(__dirname, 'migrations');

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  .join('\n');

const tables = (Object.values(schema) as unknown[])
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => getTableName(table));

describe('Row Level Security', () => {
  it('finds every table of the schema', () => {
    expect(tables.sort()).toEqual(['chunks', 'messages', 'notebooks', 'sources', 'usage_events']);
  });

  it.each(tables)('is enabled for %s', (table) => {
    expect(migrations).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });

  it('is never disabled again', () => {
    expect(migrations).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });

  it('grants nothing to the public roles through a policy or a grant', () => {
    expect(migrations).not.toMatch(/CREATE POLICY/i);
    expect(migrations).not.toMatch(/\bGRANT\b/i);
  });
});
