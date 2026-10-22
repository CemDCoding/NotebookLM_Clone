import type OpenAI from 'openai';
import type { ChatProvider, ChatStreamRequest } from './chat.provider';

/** Only the part of the `openai` client this provider uses, so tests fake just that. */
export type ChatCompletionsClient = Pick<OpenAI, 'chat'>;

/**
 * `ChatProvider` for any OpenAI-compatible API, used with Mistral and Ollama.
 * Unlike embeddings, a failed chat request is not retried: the user is waiting
 * for the answer, and the chat endpoint reports the error so another model can
 * be chosen.
 */
export class OpenAiCompatibleChatProvider implements ChatProvider {
  constructor(private readonly client: ChatCompletionsClient) {}

  async *stream({ model, messages, signal }: ChatStreamRequest): AsyncGenerator<string> {
    signal.throwIfAborted();
    try {
      const completion = await this.client.chat.completions.create(
        { model, messages: [...messages], stream: true },
        { signal },
      );
      for await (const chunk of completion) {
        // A stream that ignores the signal must still stop at the next chunk.
        signal.throwIfAborted();
        const token = chunk.choices[0]?.delta.content;
        if (token) {
          yield token;
        }
      }
    } catch (error) {
      // The SDK reports an abort as its own error class. Rethrowing the
      // signal's reason gives callers one abort error for every provider.
      if (signal.aborted) {
        throw signal.reason;
      }
      throw error;
    }
  }
}
