import { Module } from '@nestjs/common';

/**
 * Exact vector search over the active, ready sources of a notebook
 * (apps/api/CLAUDE.md "retrieval"). Registered only with the HTTP API: the chat
 * endpoint is its only consumer, the worker never searches.
 * Filled in by M4-API-03.
 */
@Module({})
export class RetrievalModule {}
