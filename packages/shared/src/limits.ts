// Default abuse and cost limits (CLAUDE.md section 7). The API makes each one
// overridable via environment variables; these are the values used when unset.
export const DEFAULT_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxPdfPages: 300,
  maxPastedTextChars: 500_000,
  maxSourcesPerNotebook: 20,
  maxNotebooksPerUser: 25,
  chatRequestsPerUserPerHour: 100,
  chatRequestsGlobalPerDay: 500,
  uploadsGlobalPerDay: 200,
} as const;

export type Limits = { [K in keyof typeof DEFAULT_LIMITS]: number };
