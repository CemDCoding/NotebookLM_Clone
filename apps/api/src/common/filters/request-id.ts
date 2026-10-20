import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

// An upstream ID is only trusted if it is short and log-safe. Anything else
// could forge or split log lines, so it is replaced by a fresh ID.
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Returns the request ID, taking a valid `X-Request-Id` header or generating
 * one. The ID is written back into the request headers so every later reader
 * sees the same value, and echoed in the response so a user can quote it.
 * Idempotent: a second call returns the ID assigned by the first.
 */
export function ensureRequestId(req: Request, res: Response): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  req.headers[REQUEST_ID_HEADER] = requestId;
  if (!res.headersSent) {
    res.setHeader(REQUEST_ID_HEADER, requestId);
  }
  return requestId;
}

/**
 * Assigns the request ID before any route handler runs. Errors raised before
 * Nest's middleware (e.g. an oversized body rejected by the body parser) skip
 * it; the exception filter calls `ensureRequestId` itself for those.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    ensureRequestId(req, res);
    next();
  }
}
