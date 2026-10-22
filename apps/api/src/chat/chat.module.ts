import { Module } from '@nestjs/common';

/**
 * Chat over the sources of a notebook: SSE endpoint, prompt, citations and
 * history (apps/api/CLAUDE.md "chat"). Registered only with the HTTP API.
 * Filled in by M4-API-04 (prompt, citations) and M4-API-06 (service, endpoint, history).
 */
@Module({})
export class ChatModule {}
