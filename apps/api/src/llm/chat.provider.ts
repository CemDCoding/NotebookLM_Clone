import type { ModelProvider } from '@notebooklm/shared';

/**
 * Injection token of the `ChatProviderFactory`. The chat service asks the
 * `ModelRegistry` for the provider of the chosen model and gets the matching
 * `ChatProvider` here, so feature modules depend only on the interface.
 */
export const CHAT_PROVIDER_FACTORY = Symbol('CHAT_PROVIDER_FACTORY');

/** Returns the `ChatProvider` that serves models of `provider`. */
export type ChatProviderFactory = (provider: ModelProvider) => ChatProvider;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatStreamRequest {
  /** Model name as the provider knows it, without the `ollama:` prefix. */
  model: string;
  messages: readonly ChatMessage[];
  /**
   * Required on purpose: when the client disconnects, aborting it must cancel
   * the provider request, so nobody pays for text nobody reads (CLAUDE.md section 7).
   */
  signal: AbortSignal;
}

/** Streams a chat completion token by token. */
export interface ChatProvider {
  /**
   * Yields the answer's text pieces in order. Once `signal` is aborted, the
   * provider request is cancelled and the iteration rejects with the signal's
   * reason, so callers never mistake a cut-off answer for a complete one.
   */
  stream(request: ChatStreamRequest): AsyncIterable<string>;
}
