import { DEFAULT_LIMITS } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { AppConfigService } from './app-config.service';
import { validateEnv } from './env.schema';

const REQUIRED = {
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pw@db.example.com:5432/postgres',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  MISTRAL_API_KEY: 'mistral-secret',
};

describe('AppConfigService', () => {
  it('exposes the default limits in the shared format', () => {
    const config = new AppConfigService(validateEnv(REQUIRED));

    expect(config.limits).toEqual(DEFAULT_LIMITS);
  });

  it('converts MAX_FILE_SIZE_MB to bytes', () => {
    const config = new AppConfigService(validateEnv({ ...REQUIRED, MAX_FILE_SIZE_MB: '3' }));

    expect(config.limits.maxFileSizeBytes).toBe(3 * 1024 * 1024);
  });

  it('enables Ollama only when a base URL is configured', () => {
    expect(new AppConfigService(validateEnv(REQUIRED)).ollama).toBeUndefined();

    const config = new AppConfigService(
      validateEnv({
        ...REQUIRED,
        OLLAMA_BASE_URL: 'http://localhost:11434/v1',
        OLLAMA_CHAT_MODELS: 'llama3.2',
      }),
    );
    expect(config.ollama).toEqual({
      baseUrl: 'http://localhost:11434/v1',
      chatModels: ['llama3.2'],
    });
  });

  it('cannot be changed at runtime', () => {
    const config = new AppConfigService(validateEnv(REQUIRED));

    expect(Object.isFrozen(config.limits)).toBe(true);
    expect(Object.isFrozen(config.chatModels)).toBe(true);
  });
});
