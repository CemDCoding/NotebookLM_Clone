import { DEFAULT_LIMITS } from '@notebooklm/shared';
import { z } from 'zod';
import { RUN_MODES } from './run-mode';

const BYTES_PER_MB = 1024 * 1024;

/** The first model is the default and the cheapest (CLAUDE.md section 6). */
export const DEFAULT_CHAT_MODELS = ['mistral-small-latest', 'ministral-8b-latest'];

const commaSeparatedList = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

const positiveInt = z.coerce.number().int().positive();

const httpUrl = z.url({ protocol: /^https?$/ });

/**
 * Every environment variable of the API except the seed-only `DEMO_USER_*`.
 * Keep in sync with `apps/api/.env.example`.
 */
export const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  RUN_MODE: z.enum(RUN_MODES).default('all'),
  // CORS compares origins as exact strings, so a trailing slash or path would block the web app.
  WEB_ORIGIN: httpUrl.refine(
    (value) => new URL(value).origin === value,
    'must be a bare origin such as https://app.example.com (no path, no trailing slash)',
  ),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  SUPABASE_URL: httpUrl,
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  MISTRAL_API_KEY: z.string().min(1),
  CHAT_MODELS: commaSeparatedList
    .pipe(z.array(z.string()).min(1, 'must name at least one model'))
    .default(DEFAULT_CHAT_MODELS),
  OLLAMA_BASE_URL: httpUrl.optional(),
  OLLAMA_CHAT_MODELS: commaSeparatedList.default([]),

  MAX_FILE_SIZE_MB: positiveInt.default(DEFAULT_LIMITS.maxFileSizeBytes / BYTES_PER_MB),
  MAX_PDF_PAGES: positiveInt.default(DEFAULT_LIMITS.maxPdfPages),
  MAX_PASTED_TEXT_CHARS: positiveInt.default(DEFAULT_LIMITS.maxPastedTextChars),
  MAX_SOURCES_PER_NOTEBOOK: positiveInt.default(DEFAULT_LIMITS.maxSourcesPerNotebook),
  MAX_NOTEBOOKS_PER_USER: positiveInt.default(DEFAULT_LIMITS.maxNotebooksPerUser),
  CHAT_LIMIT_PER_USER_PER_HOUR: positiveInt.default(DEFAULT_LIMITS.chatRequestsPerUserPerHour),
  GLOBAL_CHAT_LIMIT_PER_DAY: positiveInt.default(DEFAULT_LIMITS.chatRequestsGlobalPerDay),
  GLOBAL_UPLOAD_LIMIT_PER_DAY: positiveInt.default(DEFAULT_LIMITS.uploadsGlobalPerDay),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Thrown when the environment is invalid. The message names the variables and
 * what is wrong with them, never their values, because those may be secrets.
 */
export class EnvValidationError extends Error {
  constructor(issues: readonly z.core.$ZodIssue[]) {
    const lines = issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    super(`Invalid environment configuration:\n${lines.join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

export function validateEnv(raw: Record<string, string | undefined>): Env {
  // `.env` files turn `KEY=` into an empty string; treat it as unset so defaults and optionals apply.
  const present = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );

  const result = EnvSchema.safeParse(present, {
    error: (issue) => (issue.input === undefined ? 'is required but not set' : undefined),
  });
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}
