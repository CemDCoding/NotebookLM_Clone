import { existsSync } from 'node:fs';
import { z } from 'zod';
// Imported from the file, not the `config` barrel, which would pull in Nest decorators.
import { EnvSchema, EnvValidationError } from '../../config/env.schema';

/**
 * Only what the seed needs. The API's own variables such as `MISTRAL_API_KEY`
 * are not required, and the `DEMO_USER_*` variables never reach the API schema.
 */
export const SeedEnvSchema = EnvSchema.pick({
  DATABASE_URL: true,
  SUPABASE_URL: true,
  SUPABASE_SERVICE_ROLE_KEY: true,
}).extend({
  DEMO_USER_EMAIL: z.email(),
  // Supabase Auth rejects passwords shorter than 6 characters by default.
  DEMO_USER_PASSWORD: z.string().min(6),
});

export type SeedEnv = z.infer<typeof SeedEnvSchema>;

/**
 * Where the variables come from. `env-file`: the script was started with
 * `--env-file` (as `db:seed:prod` does), so only that file and the shell count.
 * `dotenv`: missing variables are filled from `apps/api/.env`.
 */
export type SeedEnvSource = 'env-file' | 'dotenv';

export interface LoadSeedEnvOptions {
  /** Node's flags of the current process; tsx passes `--env-file` through to them. */
  execArgv: readonly string[];
  env: NodeJS.ProcessEnv;
  /** Absolute path of `apps/api/.env`. */
  dotenvPath: string;
  /** Loads a dotenv file into `env` without overriding set variables. */
  loadEnvFile?: (path: string) => void;
}

export interface LoadedSeedEnv {
  env: SeedEnv;
  source: SeedEnvSource;
}

export function detectEnvSource(execArgv: readonly string[]): SeedEnvSource {
  return execArgv.some((flag) => /^--env-file(-if-exists)?(=|$)/.test(flag))
    ? 'env-file'
    : 'dotenv';
}

/**
 * Loads and validates the seed's environment. With an explicit env file the
 * development `.env` is never read: a variable missing in the production file
 * must stop the seed, not be silently taken from development, which would mix
 * both projects in one run.
 */
export function loadSeedEnv(options: LoadSeedEnvOptions): LoadedSeedEnv {
  const source = detectEnvSource(options.execArgv);
  if (source === 'dotenv' && existsSync(options.dotenvPath)) {
    const load = options.loadEnvFile ?? ((path: string) => process.loadEnvFile(path));
    load(options.dotenvPath);
  }
  return { env: validateSeedEnv(options.env), source };
}

export function validateSeedEnv(raw: Record<string, string | undefined>): SeedEnv {
  // Same rule as the API (`validateEnv`): `KEY=` in a dotenv file counts as unset.
  const present = Object.fromEntries(
    Object.keys(SeedEnvSchema.shape)
      .map((key) => [key, raw[key]] as const)
      .filter(([, value]) => value !== undefined && value.trim() !== ''),
  );

  const result = SeedEnvSchema.safeParse(present, {
    // Issue messages name the variable and the problem, never the value.
    error: (issue) => (issue.input === undefined ? 'is required but not set' : undefined),
  });
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}
