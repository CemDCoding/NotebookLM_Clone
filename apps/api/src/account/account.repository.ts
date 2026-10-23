import { Inject, Injectable } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/db.module';
import { type MessageRow, messages, type NotebookRow, notebooks, sources } from '../db/schema';
import type { SourceRecord } from '../sources/sources.repository';

/** A notebook as the export sees it: without the owner. */
export type ExportNotebookRecord = Pick<NotebookRow, 'id' | 'title' | 'createdAt' | 'updatedAt'>;

/** A stored message with the notebook it belongs to, for grouping. */
export type ExportMessageRecord = Pick<
  MessageRow,
  'id' | 'notebookId' | 'role' | 'content' | 'model' | 'citations' | 'createdAt'
>;

/** Everything of one user that goes into the export. */
export interface AccountData {
  notebooks: ExportNotebookRecord[];
  sources: SourceRecord[];
  messages: ExportMessageRecord[];
}

/**
 * The queries of the data export (GDPR Art. 20). Every query filters by the
 * signed-in user's ID (apps/api/CLAUDE.md "Struktur"). Only metadata and the
 * chat are read: no storage path, no chunks, no embeddings.
 */
@Injectable()
export class AccountRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Reads all three tables in one read-only snapshot, so a source or message
   * written in between cannot appear without its notebook or vice versa.
   * The order matches the app: notebooks and sources newest first, the chat
   * oldest first, each with the ID as tie-breaker.
   */
  readAll(userId: string): Promise<AccountData> {
    return this.db.transaction(
      async (tx) => ({
        notebooks: await tx
          .select({
            id: notebooks.id,
            title: notebooks.title,
            createdAt: notebooks.createdAt,
            updatedAt: notebooks.updatedAt,
          })
          .from(notebooks)
          .where(eq(notebooks.userId, userId))
          .orderBy(desc(notebooks.createdAt), desc(notebooks.id)),
        sources: await tx
          .select({
            id: sources.id,
            notebookId: sources.notebookId,
            type: sources.type,
            title: sources.title,
            status: sources.status,
            error: sources.error,
            isActive: sources.isActive,
            createdAt: sources.createdAt,
          })
          .from(sources)
          .where(eq(sources.userId, userId))
          .orderBy(desc(sources.createdAt), desc(sources.id)),
        messages: await tx
          .select({
            id: messages.id,
            notebookId: messages.notebookId,
            role: messages.role,
            content: messages.content,
            model: messages.model,
            citations: messages.citations,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.userId, userId))
          .orderBy(asc(messages.createdAt), asc(messages.id)),
      }),
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }
}
