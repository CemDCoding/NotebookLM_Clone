import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type ChatEvent,
  type ChatRequest,
  ChatStreamErrorCode,
  type Message,
} from '@notebooklm/shared';
import { NotFoundError } from '../common/errors';
import { LimitsService } from '../limits/limits.service';
import { CHAT_PROVIDER_FACTORY, type ChatProviderFactory } from '../llm/chat.provider';
import { ModelRegistry, type ResolvedModel } from '../llm/model-registry';
import { RetrievalService } from '../retrieval/retrieval.service';
import { answerTimestamp } from './answer-timestamp';
import { NoReadySourcesError } from './chat.errors';
import { ChatRepository } from './chat.repository';
import { extractCitationNumbers, mapCitations } from './citations';
import { buildPrompt, HISTORY_MESSAGE_LIMIT, type HistoryMessage } from './prompt';
import { parseStoredCitations, resolveCitation } from './resolve-citations';
import { toPromptChunks } from './to-prompt-chunks';

const NOTEBOOK_NOT_FOUND_MESSAGE = 'Das Notebook wurde nicht gefunden.';

// Generic on purpose: provider and database errors never reach the client.
const STREAM_ERROR_MESSAGES: Record<ChatStreamErrorCode, string> = {
  MODEL_UNAVAILABLE:
    'Das Modell ist gerade nicht erreichbar. Bitte versuche es erneut oder wähle ein anderes Modell.',
  STREAM_FAILED: 'Die Antwort konnte nicht erzeugt werden. Bitte versuche es erneut.',
};

/** A question that passed every check before the stream and has used up its quota. */
export interface AcceptedChat {
  userId: string;
  notebookId: string;
  question: string;
  model: ResolvedModel;
  /** When the question was accepted; it becomes the question's `created_at`. */
  acceptedAt: Date;
}

/** Which step of an answer failed; it decides the error code of the `error` event. */
type AnswerStage = 'retrieval' | 'model' | 'save';

/**
 * Chat over the active sources of a notebook (apps/api/CLAUDE.md "chat").
 * `accept` runs every check that can reject a question while a normal HTTP
 * error response is still possible; `answer` then produces the SSE events.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(ChatRepository) private readonly repository: ChatRepository,
    @Inject(ModelRegistry) private readonly models: ModelRegistry,
    @Inject(RetrievalService) private readonly retrieval: RetrievalService,
    @Inject(LimitsService) private readonly limits: LimitsService,
    @Inject(CHAT_PROVIDER_FACTORY) private readonly providers: ChatProviderFactory,
  ) {}

  /**
   * Checks in the order of PE-30: ownership (`404`), model (`400`), ready
   * sources (`409`), then the chat limits (`429`). The limits come last and
   * write the usage event, so a question rejected for any other reason costs
   * no quota.
   */
  async accept(userId: string, notebookId: string, request: ChatRequest): Promise<AcceptedChat> {
    await this.assertNotebookOwned(userId, notebookId);
    const model = this.models.resolve(request.model);
    if (!(await this.retrieval.hasReadyActiveSources(userId, notebookId))) {
      throw new NoReadySourcesError();
    }
    await this.limits.acceptChat(userId);
    return { userId, notebookId, question: request.question, model, acceptedAt: new Date() };
  }

  /**
   * Streams the answer to an accepted question: `token` events, then
   * `citations`, then `done` once question and answer are saved. A failure
   * ends with one `error` event and saves nothing. An abort of `signal`
   * reaches retrieval and provider, ends the events without `error` and saves
   * nothing either; the usage event stays, since the request already cost money.
   */
  async *answer(chat: AcceptedChat, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    const { userId, notebookId, question, model } = chat;
    const startedAt = Date.now();
    let stage: AnswerStage = 'retrieval';
    try {
      const history = await this.repository.listRecent(userId, notebookId, HISTORY_MESSAGE_LIMIT);
      const retrieved = await this.retrieval.retrieve({
        userId,
        notebookId,
        question,
        previousUserQuestion: lastUserQuestion(history),
        signal,
      });
      // One array for prompt and citations, so `[n]` points to the chunk numbered n.
      const chunks = toPromptChunks(retrieved);

      stage = 'model';
      let answer = '';
      const tokens = this.providers(model.provider).stream({
        model: model.name,
        messages: buildPrompt({ chunks, history, question }),
        signal,
      });
      for await (const text of tokens) {
        answer += text;
        yield { type: 'token', text };
      }
      if (answer.trim() === '') {
        throw new Error('Chat provider returned an empty answer');
      }

      stage = 'save';
      const stored = mapCitations(extractCitationNumbers(answer), chunks);
      yield {
        type: 'citations',
        citations: stored.map((citation) => resolveCitation(citation, chunks[citation.n - 1])),
      };

      // The client may have left while the citations were sent.
      signal.throwIfAborted();
      const messageId = await this.repository.saveExchange(
        userId,
        notebookId,
        { content: question, createdAt: chat.acceptedAt },
        {
          content: answer,
          model: model.id,
          citations: stored,
          createdAt: answerTimestamp(chat.acceptedAt),
        },
      );
      this.logger.log({
        message: 'Chat answered',
        notebookId,
        messageId,
        model: model.id,
        durationMs: Date.now() - startedAt,
        citationCount: stored.length,
      });
      yield { type: 'done', messageId, model: model.id };
    } catch (error) {
      const context = { notebookId, model: model.id, durationMs: Date.now() - startedAt };
      if (signal.aborted) {
        this.logger.log({ message: 'Chat aborted', ...context });
        return;
      }
      this.logger.error({
        message: 'Chat failed',
        ...context,
        stage,
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
      const code =
        stage === 'model'
          ? ChatStreamErrorCode.MODEL_UNAVAILABLE
          : ChatStreamErrorCode.STREAM_FAILED;
      yield { type: 'error', code, message: STREAM_ERROR_MESSAGES[code] };
    }
  }

  /**
   * The whole history, oldest first, with every citation resolved live: a
   * chunk that no longer exists yields `available: false` (PE-08).
   */
  async listMessages(userId: string, notebookId: string): Promise<Message[]> {
    await this.assertNotebookOwned(userId, notebookId);
    const records = await this.repository.list(userId, notebookId);

    const parsed = records.map((record) => {
      const { citations, invalidCount } = parseStoredCitations(record.citations);
      if (invalidCount > 0) {
        // Only the ID: an invalid entry may hold anything, including text.
        this.logger.warn({ message: 'Dropped invalid stored citations', messageId: record.id });
      }
      return { record, citations };
    });

    const chunkIds = new Set(parsed.flatMap(({ citations }) => citations.map((c) => c.chunkId)));
    const sections = new Map(
      (await this.repository.findSections(userId, notebookId, [...chunkIds])).map((section) => [
        section.chunkId,
        section,
      ]),
    );

    return parsed.map(({ record, citations }) => ({
      id: record.id,
      role: record.role,
      content: record.content,
      model: record.model,
      citations: citations.map((citation) =>
        resolveCitation(citation, sections.get(citation.chunkId)),
      ),
      // `MessageSchema` accepts only the UTC form with `Z`.
      createdAt: record.createdAt.toISOString(),
    }));
  }

  async clearMessages(userId: string, notebookId: string): Promise<void> {
    await this.assertNotebookOwned(userId, notebookId);
    const count = await this.repository.deleteAll(userId, notebookId);
    this.logger.log({ message: 'Chat history deleted', notebookId, count });
  }

  private async assertNotebookOwned(userId: string, notebookId: string): Promise<void> {
    if (!(await this.repository.notebookExists(userId, notebookId))) {
      throw new NotFoundError(NOTEBOOK_NOT_FOUND_MESSAGE);
    }
  }
}

/** The last question of the history, so a follow-up finds the topic it refers to. */
function lastUserQuestion(history: readonly HistoryMessage[]): string | undefined {
  return history.findLast((message) => message.role === 'user')?.content;
}
