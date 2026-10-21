import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvValidationError } from '../../config/env.schema';
import { detectEnvSource, loadSeedEnv, validateSeedEnv } from './seed-env';

const PROD = {
  DATABASE_URL: 'postgresql://postgres.prodref:prod-db-secret@pooler.example.com:5432/postgres',
  SUPABASE_URL: 'https://prodref.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'prod-service-role-secret',
  DEMO_USER_EMAIL: 'demo@example.test',
  DEMO_USER_PASSWORD: 'prod-demo-secret',
};

const DEV_DOTENV = [
  'DATABASE_URL=postgresql://postgres.devref:dev-db-secret@pooler.example.com:5432/postgres',
  'SUPABASE_URL=https://devref.supabase.co',
  'SUPABASE_SERVICE_ROLE_KEY=dev-service-role-secret',
  'DEMO_USER_EMAIL=dev-demo@example.test',
  'DEMO_USER_PASSWORD=dev-demo-secret',
].join('\n');

const TSX_ARGV = ['--require', 'preflight.cjs', '--import', 'loader.mjs'];

/** Mirrors `process.loadEnvFile`: fills only variables that are not set yet. */
function loadInto(env: NodeJS.ProcessEnv) {
  return (path: string) => {
    expect(path).toBe(dotenvPath);
    for (const line of DEV_DOTENV.split('\n')) {
      const [key = '', ...rest] = line.split('=');
      env[key] ??= rest.join('=');
    }
  };
}

let dir: string;
let dotenvPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seed-env-'));
  dotenvPath = join(dir, '.env');
  writeFileSync(dotenvPath, DEV_DOTENV);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('detectEnvSource', () => {
  it.each([
    [['--env-file=.env.production'], 'env-file'],
    [[...TSX_ARGV, '--env-file=.env.production'], 'env-file'],
    [['--env-file', '.env.production'], 'env-file'],
    [['--env-file-if-exists=.env.production'], 'env-file'],
    [TSX_ARGV, 'dotenv'],
    [[], 'dotenv'],
  ] as const)('%j → %s', (execArgv, expected) => {
    expect(detectEnvSource(execArgv)).toBe(expected);
  });
});

describe('loadSeedEnv', () => {
  it('fills missing variables from apps/api/.env without overriding set ones', () => {
    const env: NodeJS.ProcessEnv = { DEMO_USER_PASSWORD: 'from-the-shell' };

    const { env: seedEnv, source } = loadSeedEnv({
      execArgv: TSX_ARGV,
      env,
      dotenvPath,
      loadEnvFile: loadInto(env),
    });

    expect(source).toBe('dotenv');
    expect(seedEnv.SUPABASE_URL).toBe('https://devref.supabase.co');
    expect(seedEnv.DEMO_USER_PASSWORD).toBe('from-the-shell');
  });

  it('never reads apps/api/.env when started with --env-file', () => {
    const env: NodeJS.ProcessEnv = { ...PROD };
    const loadEnvFile = vi.fn();

    const { env: seedEnv, source } = loadSeedEnv({
      execArgv: [...TSX_ARGV, '--env-file=.env.production'],
      env,
      dotenvPath,
      loadEnvFile,
    });

    expect(source).toBe('env-file');
    expect(loadEnvFile).not.toHaveBeenCalled();
    expect(seedEnv).toEqual(PROD);
  });

  it('aborts when the env file lacks a variable, instead of taking it from development', () => {
    const env: NodeJS.ProcessEnv = { ...PROD, SUPABASE_SERVICE_ROLE_KEY: undefined };
    const loadEnvFile = vi.fn();

    const load = () =>
      loadSeedEnv({
        execArgv: ['--env-file=.env.production'],
        env,
        dotenvPath,
        loadEnvFile,
      });

    expect(load).toThrow(EnvValidationError);
    expect(load).toThrow(/SUPABASE_SERVICE_ROLE_KEY: is required but not set/);
    expect(loadEnvFile).not.toHaveBeenCalled();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  it('works without apps/api/.env', () => {
    rmSync(dotenvPath);
    const loadEnvFile = vi.fn();

    const { env } = loadSeedEnv({ execArgv: [], env: { ...PROD }, dotenvPath, loadEnvFile });

    expect(loadEnvFile).not.toHaveBeenCalled();
    expect(env).toEqual(PROD);
  });
});

describe('validateSeedEnv', () => {
  it('does not require the API-only variables such as MISTRAL_API_KEY', () => {
    expect(validateSeedEnv(PROD)).toEqual(PROD);
  });

  it('treats empty values as missing', () => {
    expect(() => validateSeedEnv({ ...PROD, DEMO_USER_EMAIL: '  ' })).toThrow(
      /DEMO_USER_EMAIL: is required but not set/,
    );
  });

  it('names invalid variables without echoing any value', () => {
    let message = '';
    try {
      validateSeedEnv({
        ...PROD,
        DATABASE_URL: 'mysql://user:db-secret@host/db',
        DEMO_USER_EMAIL: 'not-an-email-secret',
        DEMO_USER_PASSWORD: 'short',
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/DATABASE_URL/);
    expect(message).toMatch(/DEMO_USER_EMAIL/);
    expect(message).toMatch(/DEMO_USER_PASSWORD/);
    for (const value of ['db-secret', 'not-an-email-secret', 'short', ...Object.values(PROD)]) {
      expect(message).not.toContain(value);
    }
  });
});
