import { Module } from '@nestjs/common';
import { LimitsModule } from '../limits/limits.module';
import { LlmModule } from '../llm/llm.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ChatController } from './chat.controller';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';

/**
 * Chat over the sources of a notebook: SSE endpoint, prompt, citations and
 * history (apps/api/CLAUDE.md "chat"). Registered only with the HTTP API.
 */
@Module({
  imports: [LimitsModule, LlmModule, RetrievalModule],
  controllers: [ChatController],
  providers: [ChatService, ChatRepository],
})
export class ChatModule {}
