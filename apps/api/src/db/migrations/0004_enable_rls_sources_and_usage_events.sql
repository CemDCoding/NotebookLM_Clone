-- Custom migration (drizzle-kit generate --custom): enables RLS, which the schema does not express.
--
-- Same reasoning as 0002_enable_rls_notebooks (CLAUDE.md section 7): the API
-- connects as the table owner and filters every query by `user_id`. RLS
-- without any policy denies every row to the `anon` and `authenticated` roles,
-- so Supabase's public Data API returns nothing even with a known anon key.
-- `usage_events` holds no content, but still reveals who uses the app when.
-- No policies are created on purpose.
ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;
