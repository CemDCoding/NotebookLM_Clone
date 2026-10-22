import { describe, expect, it } from 'vitest';
import {
  ModelListResponseSchema,
  ModelProviderSchema,
  ModelSchema,
  OLLAMA_MODEL_ID_PREFIX,
} from './index';

const mistral = {
  id: 'mistral-small-latest',
  label: 'Mistral Small',
  provider: 'mistral',
  isLocal: false,
  isDefault: true,
};

const ollama = {
  id: 'ollama:llama3.2',
  label: 'Llama 3.2 (Lokal)',
  provider: 'ollama',
  isLocal: true,
  isDefault: false,
};

describe('ModelProviderSchema', () => {
  it('accepts exactly mistral and ollama', () => {
    expect(ModelProviderSchema.options).toEqual(['mistral', 'ollama']);
    expect(ModelProviderSchema.safeParse('openai').success).toBe(false);
  });
});

describe('ModelSchema', () => {
  it('accepts a Mistral and an Ollama model', () => {
    expect(ModelSchema.parse(mistral)).toEqual(mistral);
    expect(ModelSchema.parse(ollama)).toEqual(ollama);
  });

  it('uses the ollama: prefix from PE-32', () => {
    expect(OLLAMA_MODEL_ID_PREFIX).toBe('ollama:');
  });

  it('rejects an Ollama model without the prefix or not marked local', () => {
    expect(ModelSchema.safeParse({ ...ollama, id: 'llama3.2' }).success).toBe(false);
    expect(ModelSchema.safeParse({ ...ollama, isLocal: false }).success).toBe(false);
  });

  it('rejects a Mistral model with the prefix or marked local', () => {
    expect(ModelSchema.safeParse({ ...mistral, id: 'ollama:mistral-small' }).success).toBe(false);
    expect(ModelSchema.safeParse({ ...mistral, isLocal: true }).success).toBe(false);
  });

  it('rejects an empty id or label and missing flags', () => {
    expect(ModelSchema.safeParse({ ...mistral, id: '' }).success).toBe(false);
    expect(ModelSchema.safeParse({ ...mistral, label: '' }).success).toBe(false);
    const withoutDefault: Partial<typeof mistral> = { ...mistral };
    delete withoutDefault.isDefault;
    expect(ModelSchema.safeParse(withoutDefault).success).toBe(false);
  });
});

describe('ModelListResponseSchema', () => {
  it('accepts a list with exactly one default', () => {
    const models = [mistral, { ...mistral, id: 'ministral-8b-latest', isDefault: false }, ollama];
    expect(ModelListResponseSchema.safeParse({ models }).success).toBe(true);
  });

  it('rejects an empty list', () => {
    expect(ModelListResponseSchema.safeParse({ models: [] }).success).toBe(false);
  });

  it('rejects a list without a default or with two defaults', () => {
    const noDefault = [{ ...mistral, isDefault: false }, ollama];
    const twoDefaults = [mistral, { ...ollama, isDefault: true }];
    expect(ModelListResponseSchema.safeParse({ models: noDefault }).success).toBe(false);
    expect(ModelListResponseSchema.safeParse({ models: twoDefaults }).success).toBe(false);
  });
});
