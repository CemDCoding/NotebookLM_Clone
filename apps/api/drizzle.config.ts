import { defineConfig } from 'drizzle-kit';
// Imported from the file, not the `config` barrel, which would pull in Nest decorators.
import { loadEnv } from './src/config/load-env';

// drizzle-kit reads the connection through the same validated environment as
// the API, so `.env` locally and Railway's variables in production both work.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: { url: loadEnv().DATABASE_URL },
  strict: true,
  verbose: true,
});
