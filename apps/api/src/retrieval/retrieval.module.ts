import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { RetrievalRepository } from './retrieval.repository';
import { RetrievalService } from './retrieval.service';

/**
 * Exact vector search over the active, ready sources of a notebook
 * (apps/api/CLAUDE.md "retrieval"). Registered only with the HTTP API: the chat
 * endpoint is its only consumer, the worker never searches.
 */
@Module({
  imports: [LlmModule],
  providers: [RetrievalRepository, RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}
