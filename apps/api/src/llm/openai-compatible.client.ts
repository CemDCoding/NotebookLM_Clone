import OpenAI from 'openai';

/** Mistral's OpenAI-compatible endpoint (EU provider, CLAUDE.md section 6). */
export const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';

// Generous enough for a full embedding batch or a long streamed answer, short
// enough that a hanging provider does not block a worker slot indefinitely.
const REQUEST_TIMEOUT_MS = 60_000;

export interface OpenAiCompatibleClientOptions {
  baseUrl: string;
  apiKey: string;
}

/**
 * Creates an `openai` client for any OpenAI-compatible API (Mistral, Ollama).
 * Only base URL and key differ between providers, so adding one is a matter of
 * configuration (apps/api/CLAUDE.md "llm").
 */
export function createOpenAiCompatibleClient(options: OpenAiCompatibleClientOptions): OpenAI {
  return new OpenAI({
    baseURL: options.baseUrl,
    apiKey: options.apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    // Retries happen in `withBackoff`, where the policy is explicit and tested.
    // The SDK's own retries would multiply the attempts.
    maxRetries: 0,
  });
}
