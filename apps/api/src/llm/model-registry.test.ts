import { HttpStatus } from '@nestjs/common';
import { ErrorCode, ModelListResponseSchema } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { AppConfigService, validateEnv } from '../config';
import { ModelRegistry, UnknownModelError, mistralLabel } from './model-registry';

const REQUIRED = {
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pw@db.example.com:5432/postgres',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  MISTRAL_API_KEY: 'mistral-secret',
};

const OLLAMA = {
  OLLAMA_BASE_URL: 'http://localhost:11434/v1',
  OLLAMA_CHAT_MODELS: 'llama3.2,qwen2.5',
};

function registry(env: Record<string, string> = {}): ModelRegistry {
  return new ModelRegistry(new AppConfigService(validateEnv({ ...REQUIRED, ...env })));
}

describe('ModelRegistry', () => {
  describe('list', () => {
    it('lists the configured Mistral models with readable labels and the first as default', () => {
      expect(registry().list()).toEqual([
        {
          id: 'mistral-small-latest',
          label: 'Mistral Small',
          provider: 'mistral',
          isLocal: false,
          isDefault: true,
        },
        {
          id: 'ministral-8b-latest',
          label: 'Ministral 8B',
          provider: 'mistral',
          isLocal: false,
          isDefault: false,
        },
      ]);
    });

    it('shows no local model without OLLAMA_BASE_URL', () => {
      const models = registry({ OLLAMA_CHAT_MODELS: 'llama3.2' }).list();

      expect(models.some((model) => model.isLocal)).toBe(false);
    });

    it('adds Ollama models with the ollama: prefix and the "Lokal" mark after Mistral', () => {
      const models = registry(OLLAMA).list();

      expect(models.slice(2)).toEqual([
        {
          id: 'ollama:llama3.2',
          label: 'llama3.2 (Lokal)',
          provider: 'ollama',
          isLocal: true,
          isDefault: false,
        },
        {
          id: 'ollama:qwen2.5',
          label: 'qwen2.5 (Lokal)',
          provider: 'ollama',
          isLocal: true,
          isDefault: false,
        },
      ]);
    });

    it('lists a model configured twice only once', () => {
      const ids = registry({ CHAT_MODELS: 'mistral-small-latest,mistral-small-latest' })
        .list()
        .map((model) => model.id);

      expect(ids).toEqual(['mistral-small-latest']);
    });

    it('matches the shared contract', () => {
      expect(() =>
        ModelListResponseSchema.parse({ models: registry(OLLAMA).list() }),
      ).not.toThrow();
    });
  });

  describe('resolve', () => {
    it('uses the first model without an id', () => {
      expect(registry().resolve()).toEqual({
        id: 'mistral-small-latest',
        provider: 'mistral',
        name: 'mistral-small-latest',
      });
    });

    it('resolves an allowed Mistral model', () => {
      expect(registry().resolve('ministral-8b-latest')).toEqual({
        id: 'ministral-8b-latest',
        provider: 'mistral',
        name: 'ministral-8b-latest',
      });
    });

    it('strips the ollama: prefix from the provider name', () => {
      expect(registry(OLLAMA).resolve('ollama:llama3.2')).toEqual({
        id: 'ollama:llama3.2',
        provider: 'ollama',
        name: 'llama3.2',
      });
    });

    it.each([
      ['an unlisted Mistral model', 'mistral-large-latest'],
      ['an Ollama model without its prefix', 'llama3.2'],
      ['an Ollama id while Ollama is off', 'ollama:llama3.2'],
      ['an empty id', ''],
    ])('rejects %s with 400', (_case, id) => {
      const models = id === 'llama3.2' ? registry(OLLAMA) : registry();

      expect(() => models.resolve(id)).toThrow(UnknownModelError);
    });

    it('reports an unknown model as a German validation error', () => {
      const error = new UnknownModelError();

      expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.message).toMatch(/Modell/);
    });
  });
});

describe('mistralLabel', () => {
  it.each([
    ['mistral-small-latest', 'Mistral Small'],
    ['ministral-8b-latest', 'Ministral 8B'],
    ['mistral-large-2411', 'Mistral Large 2411'],
    ['open-mistral-nemo', 'Open Mistral Nemo'],
  ])('turns %s into %s', (name, label) => {
    expect(mistralLabel(name)).toBe(label);
  });
});
