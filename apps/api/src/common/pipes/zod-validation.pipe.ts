import {
  BadRequestException,
  HttpStatus,
  Injectable,
  StandardSchemaValidationPipe,
  type StandardSchemaValidationPipeOptions,
} from '@nestjs/common';
import { ErrorCode, type ErrorResponse } from '@notebooklm/shared';

type ValidationIssue = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>
>[0][number];

/**
 * Global validation for body, query and params. Routes declare their Zod
 * schema from `packages/shared` on the decorator, e.g.
 * `@Body({ schema: CreateNotebookSchema })`; Zod 4 implements Standard Schema,
 * which Nest's built-in pipe understands. Arguments without a schema and
 * custom decorators such as `@CurrentUser()` pass through unchanged.
 *
 * This subclass only replaces the error so it follows the shared error format
 * with a German, displayable message (PE-23).
 */
@Injectable()
export class ZodValidationPipe extends StandardSchemaValidationPipe {
  constructor() {
    super({ exceptionFactory: createValidationException });
  }
}

export function createValidationException(issues: readonly ValidationIssue[]): BadRequestException {
  const fields = [...new Set(issues.map(formatPath).filter((path) => path.length > 0))];
  const body: ErrorResponse = {
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'BadRequest',
    message:
      fields.length > 0
        ? `Die Anfrage ist ungültig. Bitte prüfe: ${fields.join(', ')}.`
        : 'Die Anfrage ist ungültig.',
    code: ErrorCode.VALIDATION_FAILED,
  };
  return new BadRequestException(body);
}

function formatPath(issue: ValidationIssue): string {
  return (issue.path ?? [])
    .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
    .join('.');
}
