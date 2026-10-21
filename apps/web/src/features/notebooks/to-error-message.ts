import { ApiError } from '@/lib/api-client';

const UNEXPECTED_ERROR_MESSAGE = 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';

/**
 * Text for an error shown to the user. `ApiError` already carries German text, including the
 * API's own message for limits (429); anything else is a bug and gets a neutral message.
 */
export function toErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNEXPECTED_ERROR_MESSAGE;
}
