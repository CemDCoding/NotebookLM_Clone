import { Inject, Injectable } from '@nestjs/common';
import type { StoredCitation } from '@notebooklm/shared';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/db.module';
import { chunks, type MessageRow, messages, notebooks, sources } from '../db/schema';
import type { HistoryMessage } from './prompt';

/** A stored message as the service sees it: without owner and notebook. */
export type MessageRecord = Pick<
  MessageRow,
  'id' | 'role' | 'content' | 'model' | 'citations' | 'createdAt'
>;

/** One side of a question-and-answer exchange, with its timestamp set by the caller. */
export interface NewMessage {
  content: string;
  createdAt: Date;
}

export interface NewAnswer extends NewMessage {
  /** The model id from the registry, e.g. `ollama:llama3.2`. */
  model: string;
  citations: readonly StoredCitation[];
}

/** A cited chunk with what a citation shows: its source's title and the full section. */
export interface CitedSection {
  chunkId: string;
  sourceId: string;
  title: string;
  content: string;
}

// The owner and the notebook are filters, never part of a result.
const columns = {
  id: messages.id,
  role: messages.role,
  content: messages.content,
  model: messages.model,
  citations: messages.citations,
  createdAt: messages.createdAt,
};

/**
 * All queries of the chat. Every method takes the signed-in user's ID and the
 * notebook ID and filters by both, so another user's history behaves exactly
 * like an empty one (apps/api/CLAUDE.md "Struktur").
 */
@Injectable()
export class ChatRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Whether the notebook exists and belongs to the user: the ownership check before any chat action. */
  async notebookExists(userId: string, notebookId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: notebooks.id })
      .from(notebooks)
      .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)));
    return row !== undefined;
  }

  /** The whole history, oldest first. The ID breaks ties, so the order is stable. */
  list(userId: string, notebookId: string): Promise<MessageRecord[]> {
    return this.db
      .select(columns)
      .from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.notebookId, notebookId)))
      .orderBy(asc(messages.createdAt), asc(messages.id));
  }

  /** The last `limit` messages for the prompt, oldest first. */
  async listRecent(userId: string, notebookId: string, limit: number): Promise<HistoryMessage[]> {
    const rows = await this.db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.notebookId, notebookId)))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit);
    return rows.reverse();
  }

  /**
   * Saves a question and its answer and returns the answer's ID. One INSERT
   * is one transaction, so both rows are stored or neither (PE-35). The
   * timestamps come from the caller: `now()` is fixed per transaction and
   * would give both rows the same value.
   */
  async saveExchange(
    userId: string,
    notebookId: string,
    question: NewMessage,
    answer: NewAnswer,
  ): Promise<string> {
    const rows = await this.db
      .insert(messages)
      .values([
        { notebookId, userId, role: 'user', ...question },
        { notebookId, userId, role: 'assistant', ...answer, citations: [...answer.citations] },
      ])
      .returning({ id: messages.id, role: messages.role });
    const saved = rows.find((row) => row.role === 'assistant');
    if (!saved) {
      throw new Error('Insert into messages returned no answer row');
    }
    return saved.id;
  }

  /** Returns how many messages were deleted. */
  async deleteAll(userId: string, notebookId: string): Promise<number> {
    const rows = await this.db
      .delete(messages)
      .where(and(eq(messages.userId, userId), eq(messages.notebookId, notebookId)))
      .returning({ id: messages.id });
    return rows.length;
  }

  /**
   * The chunks among `chunkIds` that still exist in the user's notebook, with
   * their source titles. A chunk of a deleted source is gone by cascade, so it
   * is simply missing here.
   */
  findSections(
    userId: string,
    notebookId: string,
    chunkIds: readonly string[],
  ): Promise<CitedSection[]> {
    if (chunkIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.db
      .select({
        chunkId: chunks.id,
        sourceId: chunks.sourceId,
        title: sources.title,
        content: chunks.content,
      })
      .from(chunks)
      .innerJoin(sources, eq(sources.id, chunks.sourceId))
      .where(
        and(
          inArray(chunks.id, [...chunkIds]),
          eq(chunks.userId, userId),
          eq(chunks.notebookId, notebookId),
          eq(sources.userId, userId),
        ),
      );
  }
}
