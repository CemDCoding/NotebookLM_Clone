import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCode, ErrorResponseSchema } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import {
  LimitExceededError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedFileError,
} from '../errors';
import { toErrorResponse } from './error-response';

describe('toErrorResponse', () => {
  it.each([
    [new NotFoundError(), 404, 'NotFound', ErrorCode.NOT_FOUND],
    [new LimitExceededError('Limit erreicht.'), 429, 'TooManyRequests', ErrorCode.LIMIT_EXCEEDED],
    [new PayloadTooLargeError(), 413, 'PayloadTooLarge', ErrorCode.PAYLOAD_TOO_LARGE],
    [new UnsupportedFileError(), 415, 'UnsupportedMediaType', ErrorCode.UNSUPPORTED_FILE],
  ])('maps %o to its status, code and message', (error, statusCode, name, code) => {
    expect(toErrorResponse(error)).toEqual({
      statusCode,
      error: name,
      message: error.message,
      code,
    });
  });

  it('keeps the German message of a domain error', () => {
    const response = toErrorResponse(new LimitExceededError('Maximal 20 Quellen pro Notebook.'));

    expect(response.message).toBe('Maximal 20 Quellen pro Notebook.');
  });

  it('replaces the English message of a Nest HttpException with a German default', () => {
    expect(toErrorResponse(new UnauthorizedException('jwt expired'))).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Bitte melde dich an.',
    });
  });

  it('gives an unknown route the same answer as a missing resource', () => {
    expect(toErrorResponse(new NotFoundException('Cannot GET /secret'))).toEqual(
      toErrorResponse(new NotFoundError()),
    );
  });

  it('passes through an HttpException whose body already is a shared error response', () => {
    const body = {
      statusCode: 400,
      error: 'BadRequest',
      message: 'Die Anfrage ist ungültig. Bitte prüfe: title.',
      code: ErrorCode.VALIDATION_FAILED,
    };

    expect(toErrorResponse(new BadRequestException(body))).toEqual(body);
  });

  it('does not trust a shared-format body whose status differs from the exception', () => {
    const body = {
      statusCode: 404,
      error: 'NotFound',
      message: 'Irreführend',
      code: ErrorCode.NOT_FOUND,
    };

    expect(toErrorResponse(new HttpException(body, HttpStatus.FORBIDDEN))).toEqual({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Dafür fehlt dir die Berechtigung.',
    });
  });

  it("maps the body parser's PayloadTooLargeError to 413", () => {
    const error = Object.assign(new Error('request entity too large'), {
      status: 413,
      statusCode: 413,
      expose: true,
      type: 'entity.too.large',
    });

    expect(toErrorResponse(error)).toEqual({
      statusCode: 413,
      error: 'PayloadTooLarge',
      message: 'Die Anfrage ist zu groß. Bitte kürze den Text oder wähle eine kleinere Datei.',
      code: ErrorCode.PAYLOAD_TOO_LARGE,
    });
  });

  it('treats a status on an error that is not marked as exposed as internal', () => {
    const error = Object.assign(new Error('upstream said 404'), { status: 404 });

    expect(toErrorResponse(error).statusCode).toBe(500);
  });

  it.each([new Error('relation "notebooks" does not exist'), 'a thrown string', null, undefined])(
    'turns %o into a generic 500 without details',
    (thrown) => {
      const response = toErrorResponse(thrown);

      expect(response).toEqual({
        statusCode: 500,
        error: 'InternalServerError',
        message: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.',
      });
    },
  );

  it('always produces a valid shared error response', () => {
    for (const thrown of [
      new NotFoundError(),
      new HttpException('teapot', HttpStatus.I_AM_A_TEAPOT),
      new HttpException('gateway', HttpStatus.BAD_GATEWAY),
      new Error('boom'),
    ]) {
      expect(ErrorResponseSchema.safeParse(toErrorResponse(thrown)).success).toBe(true);
    }
  });
});
