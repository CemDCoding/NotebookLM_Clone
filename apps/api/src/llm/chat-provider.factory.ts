import type { AppConfigService } from '../config';
import type { ChatProvider, ChatProviderFactory } from './chat.provider';
import { MISTRAL_BASE_URL, createOpenAiCompatibleClient } from './openai-compatible.client';
import { OpenAiCompatibleChatProvider } from './openai-compatible-chat.provider';

// Ollama ignores the key, but the `openai` client refuses to start without one.
const OLLAMA_API_KEY = 'ollama';

/**
 * Builds one `ChatProvider` per configured provider. Both speak the same
 * OpenAI-compatible API; only base URL and key differ (apps/api/CLAUDE.md "llm").
 */
export function createChatProviderFactory(
  config: Pick<AppConfigService, 'mistralApiKey' | 'ollama'>,
): ChatProviderFactory {
  const mistral = new OpenAiCompatibleChatProvider(
    createOpenAiCompatibleClient({ baseUrl: MISTRAL_BASE_URL, apiKey: config.mistralApiKey }),
  );
  const ollama: ChatProvider | undefined =
    config.ollama === undefined
      ? undefined
      : new OpenAiCompatibleChatProvider(
          createOpenAiCompatibleClient({ baseUrl: config.ollama.baseUrl, apiKey: OLLAMA_API_KEY }),
        );

  return (provider) => {
    if (provider === 'mistral') {
      return mistral;
    }
    // The registry lists Ollama models only when Ollama is configured, so this
    // is reached only by a programming error, never by user input.
    if (ollama === undefined) {
      throw new Error('Ollama is not configured');
    }
    return ollama;
  };
}
