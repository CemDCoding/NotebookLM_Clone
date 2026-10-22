import { describe, expect, it } from 'vitest';
import { createChatProviderFactory } from './chat-provider.factory';
import { OpenAiCompatibleChatProvider } from './openai-compatible-chat.provider';

describe('createChatProviderFactory', () => {
  it('serves Mistral models', () => {
    const factory = createChatProviderFactory({ mistralApiKey: 'test-key', ollama: undefined });

    expect(factory('mistral')).toBeInstanceOf(OpenAiCompatibleChatProvider);
  });

  it('refuses Ollama while it is not configured', () => {
    const factory = createChatProviderFactory({ mistralApiKey: 'test-key', ollama: undefined });

    expect(() => factory('ollama')).toThrow('Ollama is not configured');
  });

  it('serves Ollama models with their own provider when configured', () => {
    const factory = createChatProviderFactory({
      mistralApiKey: 'test-key',
      ollama: { baseUrl: 'http://localhost:11434/v1', chatModels: ['llama3.2'] },
    });

    expect(factory('ollama')).toBeInstanceOf(OpenAiCompatibleChatProvider);
    expect(factory('ollama')).not.toBe(factory('mistral'));
  });
});
