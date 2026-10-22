import { Module } from '@nestjs/common';
import { AppConfigService } from '../config';
import { CHAT_PROVIDER_FACTORY, type ChatProviderFactory } from './chat.provider';
import { createChatProviderFactory } from './chat-provider.factory';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from './embedding.provider';
import { ModelRegistry } from './model-registry';
import { MISTRAL_BASE_URL, createOpenAiCompatibleClient } from './openai-compatible.client';
import { OpenAiCompatibleEmbeddingProvider } from './openai-compatible-embedding.provider';

/**
 * Provider layer for chat and embeddings behind one OpenAI-compatible
 * interface (CLAUDE.md section 6, apps/api/CLAUDE.md "llm"). Loaded in every
 * mode: the worker embeds chunks, the API embeds questions and streams answers.
 * It has no controller; `GET /models` lives in `ModelsModule`.
 */
@Module({
  providers: [
    {
      provide: EMBEDDING_PROVIDER,
      inject: [AppConfigService],
      // Always Mistral, also locally with Ollama: every vector must come from
      // `mistral-embed` (CLAUDE.md section 6).
      useFactory: (config: AppConfigService): EmbeddingProvider =>
        new OpenAiCompatibleEmbeddingProvider(
          createOpenAiCompatibleClient({ baseUrl: MISTRAL_BASE_URL, apiKey: config.mistralApiKey }),
        ),
    },
    {
      provide: CHAT_PROVIDER_FACTORY,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): ChatProviderFactory =>
        createChatProviderFactory(config),
    },
    ModelRegistry,
  ],
  exports: [EMBEDDING_PROVIDER, CHAT_PROVIDER_FACTORY, ModelRegistry],
})
export class LlmModule {}
