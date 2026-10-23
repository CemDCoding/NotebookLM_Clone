import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  type ChatRequest,
  ChatRequestSchema,
  type MessageListResponse,
  type NotebookIdParams,
  NotebookIdParamsSchema,
} from '@notebooklm/shared';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators';
import { ChatService } from './chat.service';
import { openEventStream, toSseFrame } from './sse';

/** Chat and history of a notebook, nested under it (PE-07). */
@Controller('notebooks/:id')
export class ChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  /**
   * Answers as an SSE stream over the raw Express response (PE-20), because
   * Nest's `@Sse` only supports GET.
   */
  @Post('chat')
  async ask(
    @CurrentUser() userId: string,
    @Param({ schema: NotebookIdParamsSchema }) params: NotebookIdParams,
    @Body({ schema: ChatRequestSchema }) body: ChatRequest,
    @Res() res: Response,
  ): Promise<void> {
    // `res`, not `req`: since Node 16 the request emits `close` as soon as its
    // body is read. The response closes when the connection ends, and only
    // before `end()` that means the client left.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abort.abort();
      }
    });

    // Every rejection (404, 400, 409, 429) happens before the stream opens,
    // so the global filter can still answer it as a JSON error response.
    const accepted = await this.chat.accept(userId, params.id, body);
    if (abort.signal.aborted) {
      return;
    }

    openEventStream(res);
    for await (const event of this.chat.answer(accepted, abort.signal)) {
      if (abort.signal.aborted) {
        break;
      }
      res.write(toSseFrame(event));
    }
    res.end();
  }

  @Get('messages')
  async listMessages(
    @CurrentUser() userId: string,
    @Param({ schema: NotebookIdParamsSchema }) params: NotebookIdParams,
  ): Promise<MessageListResponse> {
    return { messages: await this.chat.listMessages(userId, params.id) };
  }

  @Delete('messages')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearMessages(
    @CurrentUser() userId: string,
    @Param({ schema: NotebookIdParamsSchema }) params: NotebookIdParams,
  ): Promise<void> {
    return this.chat.clearMessages(userId, params.id);
  }
}
