import { describe, expect, it } from 'vitest';
import { MISTRAL_BASE_URL, createOpenAiCompatibleClient } from './openai-compatible.client';

describe('createOpenAiCompatibleClient', () => {
  it('uses the given base URL and leaves retries to withBackoff', () => {
    const client = createOpenAiCompatibleClient({ baseUrl: MISTRAL_BASE_URL, apiKey: 'test-key' });

    expect(client.baseURL).toBe('https://api.mistral.ai/v1');
    expect(client.maxRetries).toBe(0);
  });
});
