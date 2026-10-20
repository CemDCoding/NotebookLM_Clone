-- Custom migration (drizzle-kit generate --custom): drizzle-kit cannot express extensions.
--
-- pgvector provides the `vector(1024)` column of `chunks` and the cosine
-- distance operator used by the retrieval (CLAUDE.md section 4). Supabase
-- keeps extensions in the `extensions` schema, which is on the search path of
-- the database roles; installing them into `public` would expose them through
-- the Data API. IF NOT EXISTS keeps this idempotent when the extension was
-- already enabled in the dashboard (docs/deployment.md "Supabase").
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
