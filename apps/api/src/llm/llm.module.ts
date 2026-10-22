import { Module } from '@nestjs/common';
import { AppConfigService } from '../config';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from './embedding.provider';
import { MISTRAL_BASE_URL, createOpenAiCompatibleClient } from './openai-compatible.client';
import { OpenAiCompatibleEmbeddingProvider } from './openai-compatible-embedding.provider';

/**
 * Provider layer for chat and embeddings behind one OpenAI-compatible
 * interface (CLAUDE.md section 6, apps/api/CLAUDE.md "llm"). Loaded in every
 * mode: the worker embeds chunks, the API embeds questions and streams answers.
 * The chat side follows in M4-API-02.
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
  ],
  exports: [EMBEDDING_PROVIDER],
})
export class LlmModule {}
