import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, type ErrorResponse, ErrorResponseSchema } from '@notebooklm/shared';
import { DomainError } from '../errors';

// German, displayable default messages (PE-23). Messages of Nest's own
// exceptions are English and may echo request details, so they never reach the client.
const DEFAULT_MESSAGES: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Die Anfrage ist ungültig.',
  [HttpStatus.UNAUTHORIZED]: 'Bitte melde dich an.',
  [HttpStatus.FORBIDDEN]: 'Dafür fehlt dir die Berechtigung.',
  [HttpStatus.NOT_FOUND]: 'Die angeforderte Ressource wurde nicht gefunden.',
  [HttpStatus.PAYLOAD_TOO_LARGE]:
    'Die Anfrage ist zu groß. Bitte kürze den Text oder wähle eine kleinere Datei.',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Dieses Format wird nicht unterstützt.',
  [HttpStatus.TOO_MANY_REQUESTS]:
    'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.',
  [HttpStatus.SERVICE_UNAVAILABLE]:
    'Der Dienst ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
};
const FALLBACK_CLIENT_MESSAGE = 'Die Anfrage konnte nicht verarbeitet werden.';
const FALLBACK_SERVER_MESSAGE =
  'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.';

// Codes that follow from the status alone, so e.g. an unknown route and a
// foreign notebook look the same to the client.
const DEFAULT_CODES: Partial<Record<HttpStatus, ErrorCode>> = {
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
};

/**
 * Maps any thrown value to the shared error format:
 * - `DomainError`: its status, code and German message.
 * - Nest `HttpException`: its status; its body only if it already is a shared
 *   error response with a `code` (e.g. from the validation pipe), otherwise
 *   the default message.
 * - Client errors from Express middleware (`http-errors`, e.g. the body
 *   parser's `PayloadTooLargeError`): their status with the default message.
 * - Anything else: `500` with a generic message, never internal details.
 */
export function toErrorResponse(exception: unknown): ErrorResponse {
  if (exception instanceof DomainError) {
    return {
      ...fromStatus(exception.statusCode),
      message: exception.message,
      code: exception.code,
    };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    // Nest's default body `{ statusCode, message, error }` also fits the schema,
    // so only a body with an `ErrorCode` counts as deliberately built for the client.
    const body = ErrorResponseSchema.safeParse(exception.getResponse());
    return body.success && body.data.code !== undefined && body.data.statusCode === status
      ? body.data
      : fromStatus(status);
  }
  const clientErrorStatus = exposedClientErrorStatus(exception);
  if (clientErrorStatus !== undefined) {
    return fromStatus(clientErrorStatus);
  }
  return fromStatus(HttpStatus.INTERNAL_SERVER_ERROR);
}

function fromStatus(status: number): ErrorResponse {
  const isValidStatus = Number.isInteger(status) && status >= 400 && status <= 599;
  const statusCode = isValidStatus ? status : HttpStatus.INTERNAL_SERVER_ERROR;
  const response: ErrorResponse = {
    statusCode,
    error: statusName(statusCode),
    message:
      DEFAULT_MESSAGES[statusCode as HttpStatus] ??
      (statusCode < 500 ? FALLBACK_CLIENT_MESSAGE : FALLBACK_SERVER_MESSAGE),
  };
  const code = DEFAULT_CODES[statusCode as HttpStatus];
  return code === undefined ? response : { ...response, code };
}

/** `error` is the English name of the HTTP status in PascalCase, e.g. `NotFound` (PE-23). */
function statusName(status: number): string {
  const name: string | undefined = HttpStatus[status];
  if (name === undefined) {
    return status < 500 ? 'ClientError' : 'ServerError';
  }
  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * `http-errors`, used by Express and its body parser, marks errors whose
 * message is meant for the client with `expose: true` (always 4xx). Only those
 * keep their status; everything else is treated as an internal error.
 */
function exposedClientErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) {
    return undefined;
  }
  const { status, expose } = exception as { status?: unknown; expose?: unknown };
  return expose === true && typeof status === 'number' && status >= 400 && status < 500
    ? status
    : undefined;
}
