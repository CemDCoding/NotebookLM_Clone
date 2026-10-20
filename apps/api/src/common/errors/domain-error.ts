import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@notebooklm/shared';

/**
 * Base class of all expected business errors. The global exception filter
 * turns it into the shared error format, so services never deal with HTTP.
 *
 * `message` reaches the client unchanged and is shown in the UI (PE-23): it
 * must be German, displayable text and must never contain internal details
 * such as IDs of other users, SQL or provider responses.
 */
export abstract class DomainError extends Error {
  protected constructor(
    readonly statusCode: HttpStatus,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Missing resources and resources of other users alike, so their existence stays hidden. */
export class NotFoundError extends DomainError {
  constructor(message = 'Die angeforderte Ressource wurde nicht gefunden.') {
    super(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, message);
  }
}

/** A business limit is reached. The message names the limit, the web app shows it directly. */
export class LimitExceededError extends DomainError {
  constructor(message: string) {
    super(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.LIMIT_EXCEEDED, message);
  }
}

export class PayloadTooLargeError extends DomainError {
  constructor(message = 'Die Anfrage ist zu groß.') {
    super(HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.PAYLOAD_TOO_LARGE, message);
  }
}

/** The uploaded content is not a supported type, judged by content rather than extension. */
export class UnsupportedFileError extends DomainError {
  constructor(
    message = 'Dieser Dateityp wird nicht unterstützt. Erlaubt sind PDF, TXT und Markdown.',
  ) {
    super(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UNSUPPORTED_FILE, message);
  }
}
