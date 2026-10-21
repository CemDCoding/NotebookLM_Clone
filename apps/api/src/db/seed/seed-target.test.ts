import { describe, expect, it } from 'vitest';
import { resolveSeedTarget } from './seed-target';

const POOLER = 'aws-0-eu-central-1.pooler.supabase.com:5432';

describe('resolveSeedTarget', () => {
  it('returns the database host and the project URL without credentials', () => {
    const target = resolveSeedTarget({
      DATABASE_URL: `postgresql://postgres.abc123:db-secret@${POOLER}/postgres`,
      SUPABASE_URL: 'https://abc123.supabase.co/',
    });

    expect(target).toEqual({ databaseHost: POOLER, supabaseUrl: 'https://abc123.supabase.co' });
    expect(JSON.stringify(target)).not.toContain('db-secret');
  });

  it('accepts a direct connection of the same project', () => {
    expect(
      resolveSeedTarget({
        DATABASE_URL: 'postgresql://postgres:db-secret@db.abc123.supabase.co:5432/postgres',
        SUPABASE_URL: 'https://abc123.supabase.co',
      }).databaseHost,
    ).toBe('db.abc123.supabase.co:5432');
  });

  it('rejects a database and an Auth project of different Supabase projects', () => {
    const resolve = () =>
      resolveSeedTarget({
        DATABASE_URL: `postgresql://postgres.devref:db-secret@${POOLER}/postgres`,
        SUPABASE_URL: 'https://prodref.supabase.co',
      });

    expect(resolve).toThrow(/different Supabase projects \(devref vs\. prodref\)/);
    expect(resolve).not.toThrow(/db-secret/);
  });

  it('skips the project check for hosts outside Supabase', () => {
    expect(() =>
      resolveSeedTarget({
        DATABASE_URL: 'postgresql://postgres:pw@localhost:5432/postgres',
        SUPABASE_URL: 'https://abc123.supabase.co',
      }),
    ).not.toThrow();
  });
});
