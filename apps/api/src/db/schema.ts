// Drizzle schema: the single source of truth for all tables (apps/api/CLAUDE.md "Datenbank").
//
// Still empty in M0. Each milestone's scaffold package (`Mx-API-01`, PE-02) adds
// its tables here and generates the migration with `pnpm --filter api db:generate`.
// Every table gets `user_id`, `ON DELETE CASCADE` on its parent key, RLS and
// indexes on its filter columns. Statements drizzle-kit cannot express
// (extensions, enabling RLS) go into separate, commented custom migrations.
export {};
