import { Module } from '@nestjs/common';

/**
 * Provider layer for chat and embeddings behind one OpenAI-compatible
 * interface (CLAUDE.md section 6, apps/api/CLAUDE.md "llm"). Loaded in every
 * mode: the worker embeds chunks, the API embeds questions and streams answers.
 * Filled in by M3-API-03 (embeddings) and M4-API-02 (chat).
 */
@Module({})
export class LlmModule {}
