import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type Env, validateEnv } from './env.schema';

// apps/api/.env, resolved from both src/config (tests) and dist/config (build).
const ENV_FILE = join(__dirname, '..', '..', '.env');

/**
 * Loads `apps/api/.env` if present and validates the environment. Railway
 * injects variables directly, so the file is optional, and variables that are
 * already set take precedence over the file.
 */
export function loadEnv(): Env {
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }
  return validateEnv(process.env);
}
