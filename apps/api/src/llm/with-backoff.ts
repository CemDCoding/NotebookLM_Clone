import { APIError } from 'openai';

export interface BackoffOptions {
  /** Aborts waiting and further attempts; the running attempt sees it through its own request. */
  signal?: AbortSignal | undefined;
  /** Total attempts including the first one (PE-14). */
  maxAttempts?: number;
  /** Delay before the second attempt; it doubles for every further one. */
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Replaceable so tests run without real waiting. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 16_000;

/**
 * Rate limits (`429`) and server errors (`5xx`) are transient. Everything else,
 * such as a rejected key or a malformed request, fails the same way again.
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof APIError) || error.status === undefined) {
    return false;
  }
  return error.status === 429 || error.status >= 500;
}

/**
 * Runs `operation` and retries transient provider errors with exponential
 * backoff: 1 s, 2 s, 4 s, 8 s by default, at most 5 attempts in total. Gives up
 * immediately once `signal` is aborted, so a cancelled job or request causes
 * no further provider calls.
 */
export async function withBackoff<T>(
  operation: (signal: AbortSignal | undefined) => Promise<T>,
  options: BackoffOptions = {},
): Promise<T> {
  const {
    signal,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    sleep = abortableSleep,
  } = options;

  for (let attempt = 1; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await operation(signal);
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableError(error) || signal?.aborted) {
        throw error;
      }
    }
    await sleep(Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs), signal);
  }
}

/** Waits `ms`, or rejects with the abort reason as soon as `signal` fires. */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
