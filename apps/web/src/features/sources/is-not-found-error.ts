import { ApiError } from '@/lib/api-client';

/** The API answers `404` for missing and for foreign resources alike, so both end up here. */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Retries once like every other query, but never a `404`: asking again cannot change it. */
export function retryUnlessNotFound(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && !isNotFoundError(error);
}
