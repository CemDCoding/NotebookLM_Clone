import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toErrorResponse } from './error-response';
import { ensureRequestId } from './request-id';

/**
 * Global filter (registered via `APP_FILTER`) that answers every failed HTTP
 * request in the shared error format. It logs only the error class, status and
 * request ID: messages and stacks may contain user content or SQL (PE-29,
 * CLAUDE.md section 7 "DSGVO").
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = ensureRequestId(req, res);
    const body = toErrorResponse(exception);

    const context = {
      message: 'Request failed',
      requestId,
      statusCode: body.statusCode,
      errorClass: errorClassOf(exception),
    };
    if (body.statusCode >= 500) {
      this.logger.error(context);
    } else {
      this.logger.warn(context);
    }

    // A streaming response (SSE) may fail after its headers are out; a JSON
    // body is impossible then, so the connection is closed instead.
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(body.statusCode).json(body);
  }
}

function errorClassOf(exception: unknown): string {
  if (exception instanceof Error) {
    return exception.constructor.name;
  }
  return exception === null ? 'null' : typeof exception;
}
