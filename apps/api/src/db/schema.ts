// Drizzle schema: the single source of truth for all tables (apps/api/CLAUDE.md "Datenbank").
//
// Each milestone's scaffold package (`Mx-API-01`, PE-02) adds its tables here and
// generates the migration with `pnpm --filter api db:generate`. Every table gets
// `user_id`, `ON DELETE CASCADE` on its parent key, RLS and indexes on its
// filter columns. Statements drizzle-kit cannot express (extensions, enabling
// RLS) go into separate, commented custom migrations.
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

// Supabase's `auth.users`, owned by Supabase Auth. Only the key is declared, as
// the target of foreign keys. It is not exported, so drizzle-kit never tries to
// create or alter it. (`drizzle-orm/supabase` has the same table, but its ESM
// typings clash with the CommonJS build of `pg-core` this package resolves.)
const authUsers = pgSchema('auth').table('users', {
  id: uuid('id').primaryKey(),
});

export const notebooks = pgTable(
  'notebooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Deleting an account (done by the operator) removes all its notebooks, and
    // with them everything that cascades from a notebook (CLAUDE.md section 7, Art. 17).
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Every notebook query filters by the owner (CLAUDE.md section 7).
  (table) => [index('notebooks_user_id_idx').on(table.userId)],
);

export type NotebookRow = typeof notebooks.$inferSelect;
export type NewNotebookRow = typeof notebooks.$inferInsert;

// The value lists mirror `SourceTypeSchema` and `SourceStatusSchema` in
// `packages/shared`; the database enforces them as well.
export const sourceType = pgEnum('source_type', ['pdf', 'text', 'markdown', 'pasted']);
export const sourceStatus = pgEnum('source_status', ['pending', 'processing', 'ready', 'failed']);

export const sources = pgTable(
  'sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    notebookId: uuid('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    // Denormalised owner, so every query filters by `user_id` directly
    // (apps/api/CLAUDE.md "Struktur"). Deleting the account cascades via the notebook.
    userId: uuid('user_id').notNull(),
    type: sourceType('type').notNull(),
    title: text('title').notNull(),
    // Empty for pasted text: its file follows the path scheme `{userId}/{sourceId}` (PE-16).
    storagePath: text('storage_path'),
    status: sourceStatus('status').notNull().default('pending'),
    // User-facing German message, set only when `status` is `failed`.
    error: text('error'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sources_user_id_idx').on(table.userId),
    index('sources_notebook_id_idx').on(table.notebookId),
  ],
);

export type SourceRow = typeof sources.$inferSelect;
export type NewSourceRow = typeof sources.$inferInsert;

export const usageEventKind = pgEnum('usage_event_kind', ['chat', 'upload']);

// Counting log for the usage limits (CLAUDE.md sections 4 and 7). It has no
// link to notebooks or sources on purpose: deleting chats or sources must not
// reset the limits. Rows older than 7 days are removed by a daily job (M3).
export const usageEvents = pgTable(
  'usage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // When the operator deletes an account, its events stay and only count
    // towards the global limits from then on (CLAUDE.md section 4).
    userId: uuid('user_id').references(() => authUsers.id, { onDelete: 'set null' }),
    kind: usageEventKind('kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // Global limits count by kind and time, per-user limits add the user.
  (table) => [
    index('usage_events_kind_created_at_idx').on(table.kind, table.createdAt),
    index('usage_events_user_id_kind_created_at_idx').on(table.userId, table.kind, table.createdAt),
  ],
);

export type UsageEventRow = typeof usageEvents.$inferSelect;
export type NewUsageEventRow = typeof usageEvents.$inferInsert;

// The dimension of `mistral-embed`, the only embedding model in every
// environment (CLAUDE.md section 6). Changing it requires re-indexing all chunks.
export const EMBEDDING_DIMENSIONS = 1024;

// Text sections of a source with their embeddings, written by the ingestion
// worker (apps/api/CLAUDE.md "sources und ingestion"). There is no vector index:
// retrieval runs an exact search filtered by `notebook_id` (CLAUDE.md section 9).
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Deleting a source removes its chunks and vectors (CLAUDE.md section 7, Art. 17).
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    // Denormalised, so the vector search filters by notebook without a join
    // over `sources` (CLAUDE.md section 4).
    notebookId: uuid('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    // Denormalised owner, as in `sources`; every query filters by it.
    userId: uuid('user_id').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    // PDF page the section starts on; empty for text, Markdown and pasted text.
    page: integer('page'),
    // Order of the section within its source.
    position: integer('position').notNull(),
  },
  (table) => [
    index('chunks_notebook_id_idx').on(table.notebookId),
    index('chunks_user_id_idx').on(table.userId),
    index('chunks_source_id_idx').on(table.sourceId),
  ],
);

export type ChunkRow = typeof chunks.$inferSelect;
export type NewChunkRow = typeof chunks.$inferInsert;

// Mirrors `MessageRoleSchema` in `packages/shared`; the database enforces it as well.
export const messageRole = pgEnum('message_role', ['user', 'assistant']);

// Chat history per notebook (apps/api/CLAUDE.md "chat"). A question and its
// answer are written together only after the stream has completed.
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Deleting a notebook removes its chat history (CLAUDE.md section 7, Art. 17).
    notebookId: uuid('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    // Denormalised owner, as in `sources`; every query filters by it.
    userId: uuid('user_id').notNull(),
    role: messageRole('role').notNull(),
    content: text('content').notNull(),
    // Only answers record the model that wrote them; null for questions.
    model: text('model'),
    // `StoredCitation` references from `packages/shared` only, never source
    // text, so deleting a source leaves nothing of it behind (PE-08). Typed as
    // `unknown[]` because the contract is validated with its Zod schema on read.
    citations: jsonb('citations').$type<unknown[]>().notNull().default([]),
    // `now()` is fixed per transaction, so a question and its answer saved
    // together share the default. The writer sets distinct values to keep the order.
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // The history is read per notebook in chronological order.
  (table) => [
    index('messages_notebook_id_created_at_idx').on(table.notebookId, table.createdAt),
    index('messages_user_id_idx').on(table.userId),
  ],
);

export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
