import { DEFAULT_LIMITS } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CHAT_MODELS, EnvValidationError, validateEnv } from './env.schema';

const REQUIRED = {
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pw@db.example.com:5432/postgres',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  MISTRAL_API_KEY: 'mistral-secret',
};

function validationMessage(raw: Record<string, string | undefined>): string {
  try {
    validateEnv(raw);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    return (error as EnvValidationError).message;
  }
  throw new Error('expected validateEnv to throw');
}

describe('validateEnv', () => {
  it('applies the defaults when only the required variables are set', () => {
    const env = validateEnv(REQUIRED);

    expect(env.PORT).toBe(4000);
    expect(env.RUN_MODE).toBe('all');
    expect(env.CHAT_MODELS).toEqual(DEFAULT_CHAT_MODELS);
    expect(env.OLLAMA_BASE_URL).toBeUndefined();
    expect(env.OLLAMA_CHAT_MODELS).toEqual([]);
    expect(env.MAX_FILE_SIZE_MB * 1024 * 1024).toBe(DEFAULT_LIMITS.maxFileSizeBytes);
    expect(env.MAX_PDF_PAGES).toBe(DEFAULT_LIMITS.maxPdfPages);
    expect(env.MAX_PASTED_TEXT_CHARS).toBe(DEFAULT_LIMITS.maxPastedTextChars);
    expect(env.MAX_SOURCES_PER_NOTEBOOK).toBe(DEFAULT_LIMITS.maxSourcesPerNotebook);
    expect(env.MAX_NOTEBOOKS_PER_USER).toBe(DEFAULT_LIMITS.maxNotebooksPerUser);
    expect(env.CHAT_LIMIT_PER_USER_PER_HOUR).toBe(DEFAULT_LIMITS.chatRequestsPerUserPerHour);
    expect(env.GLOBAL_CHAT_LIMIT_PER_DAY).toBe(DEFAULT_LIMITS.chatRequestsGlobalPerDay);
    expect(env.GLOBAL_UPLOAD_LIMIT_PER_DAY).toBe(DEFAULT_LIMITS.uploadsGlobalPerDay);
  });

  it.each(Object.keys(REQUIRED))('rejects a missing %s and names it', (name) => {
    const message = validationMessage({ ...REQUIRED, [name]: undefined });

    expect(message).toContain(`${name}: is required but not set`);
  });

  it('treats an empty value like a missing one', () => {
    const message = validationMessage({ ...REQUIRED, MISTRAL_API_KEY: '' });

    expect(message).toContain('MISTRAL_API_KEY: is required but not set');
  });

  it('never puts values into the error message', () => {
    const message = validationMessage({ ...REQUIRED, PORT: 'not-a-port' });

    expect(message).toContain('PORT');
    for (const value of [...Object.values(REQUIRED), 'not-a-port']) {
      expect(message).not.toContain(value);
    }
  });

  it('rejects an invalid RUN_MODE', () => {
    expect(validationMessage({ ...REQUIRED, RUN_MODE: 'both' })).toContain('RUN_MODE');
  });

  it.each(['all', 'api', 'worker'])('accepts RUN_MODE=%s', (mode) => {
    expect(validateEnv({ ...REQUIRED, RUN_MODE: mode }).RUN_MODE).toBe(mode);
  });

  it('rejects a WEB_ORIGIN with a path or trailing slash', () => {
    expect(validationMessage({ ...REQUIRED, WEB_ORIGIN: 'http://localhost:3000/' })).toContain(
      'WEB_ORIGIN',
    );
  });

  it('rejects a DATABASE_URL that is not a Postgres URL', () => {
    expect(validationMessage({ ...REQUIRED, DATABASE_URL: 'https://db.example.com' })).toContain(
      'DATABASE_URL',
    );
  });

  it('parses overrides: numbers and comma-separated model lists', () => {
    const env = validateEnv({
      ...REQUIRED,
      PORT: '8080',
      MAX_PDF_PAGES: '50',
      CHAT_MODELS: ' ministral-8b-latest , mistral-small-latest ,',
      OLLAMA_BASE_URL: 'http://localhost:11434/v1',
      OLLAMA_CHAT_MODELS: 'llama3.2,qwen2.5',
    });

    expect(env.PORT).toBe(8080);
    expect(env.MAX_PDF_PAGES).toBe(50);
    expect(env.CHAT_MODELS).toEqual(['ministral-8b-latest', 'mistral-small-latest']);
    expect(env.OLLAMA_BASE_URL).toBe('http://localhost:11434/v1');
    expect(env.OLLAMA_CHAT_MODELS).toEqual(['llama3.2', 'qwen2.5']);
  });

  it('rejects limits that are not positive integers', () => {
    expect(validationMessage({ ...REQUIRED, MAX_SOURCES_PER_NOTEBOOK: '0' })).toContain(
      'MAX_SOURCES_PER_NOTEBOOK',
    );
    expect(validationMessage({ ...REQUIRED, MAX_FILE_SIZE_MB: '2.5' })).toContain(
      'MAX_FILE_SIZE_MB',
    );
  });

  it('rejects a CHAT_MODELS list without any model', () => {
    expect(validationMessage({ ...REQUIRED, CHAT_MODELS: ' , ' })).toContain('CHAT_MODELS');
  });

  it('drops variables that the API does not use, such as the seed credentials', () => {
    const env = validateEnv({ ...REQUIRED, DEMO_USER_PASSWORD: 'seed-only' });

    expect(env).not.toHaveProperty('DEMO_USER_PASSWORD');
  });
});
