import type { Limits } from '@notebooklm/shared';
import type { Env } from './env.schema';
import type { RunMode } from './run-mode';

const BYTES_PER_MB = 1024 * 1024;

export interface OllamaConfig {
  baseUrl: string;
  chatModels: readonly string[];
}

/**
 * Typed, validated configuration. The only way application code reads
 * settings; nothing outside `config/` touches `process.env`.
 */
export class AppConfigService {
  readonly port: number;
  readonly runMode: RunMode;
  readonly webOrigin: string;
  readonly databaseUrl: string;
  readonly supabaseUrl: string;
  readonly supabaseServiceRoleKey: string;
  readonly mistralApiKey: string;
  /** Allowed chat models for the picker; the first one is the default. */
  readonly chatModels: readonly string[];
  /** Set only when `OLLAMA_BASE_URL` is configured (local development). */
  readonly ollama: OllamaConfig | undefined;
  readonly limits: Readonly<Limits>;

  constructor(env: Env) {
    this.port = env.PORT;
    this.runMode = env.RUN_MODE;
    this.webOrigin = env.WEB_ORIGIN;
    this.databaseUrl = env.DATABASE_URL;
    this.supabaseUrl = env.SUPABASE_URL;
    this.supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    this.mistralApiKey = env.MISTRAL_API_KEY;
    this.chatModels = Object.freeze([...env.CHAT_MODELS]);
    this.ollama =
      env.OLLAMA_BASE_URL === undefined
        ? undefined
        : Object.freeze({
            baseUrl: env.OLLAMA_BASE_URL,
            chatModels: Object.freeze([...env.OLLAMA_CHAT_MODELS]),
          });
    this.limits = Object.freeze({
      maxFileSizeBytes: env.MAX_FILE_SIZE_MB * BYTES_PER_MB,
      maxPdfPages: env.MAX_PDF_PAGES,
      maxPastedTextChars: env.MAX_PASTED_TEXT_CHARS,
      maxSourcesPerNotebook: env.MAX_SOURCES_PER_NOTEBOOK,
      maxNotebooksPerUser: env.MAX_NOTEBOOKS_PER_USER,
      chatRequestsPerUserPerHour: env.CHAT_LIMIT_PER_USER_PER_HOUR,
      chatRequestsGlobalPerDay: env.GLOBAL_CHAT_LIMIT_PER_DAY,
      uploadsGlobalPerDay: env.GLOBAL_UPLOAD_LIMIT_PER_DAY,
    });
  }
}
