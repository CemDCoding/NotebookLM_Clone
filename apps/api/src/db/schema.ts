// Drizzle schema: the single source of truth for all tables (apps/api/CLAUDE.md "Datenbank").
//
// Each milestone's scaffold package (`Mx-API-01`, PE-02) adds its tables here and
// generates the migration with `pnpm --filter api db:generate`. Every table gets
// `user_id`, `ON DELETE CASCADE` on its parent key, RLS and indexes on its
// filter columns. Statements drizzle-kit cannot express (extensions, enabling
// RLS) go into separate, commented custom migrations.
import { index, pgSchema, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
