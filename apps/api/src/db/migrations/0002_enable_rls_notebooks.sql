-- Custom migration (drizzle-kit generate --custom): enables RLS, which the schema does not express.
--
-- Defense in depth (CLAUDE.md section 7): all data access runs through the API,
-- which connects as the table owner and filters every query by `user_id`. RLS
-- without any policy denies every row to the `anon` and `authenticated` roles,
-- so Supabase's public Data API returns nothing even with a known anon key.
-- No policies are created on purpose.
ALTER TABLE "notebooks" ENABLE ROW LEVEL SECURITY;
