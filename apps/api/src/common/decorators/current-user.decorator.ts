import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types';

/**
 * Injects the signed-in user's ID: `list(@CurrentUser() userId: string)`.
 * The ID comes only from the token verified by the auth guard, never from
 * body or query (apps/api/CLAUDE.md "auth").
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>();
  const userId = request.user?.id;
  // Fails closed: without a verified user (e.g. on a `@Public()` route) a
  // repository must never receive an undefined `userId`.
  if (!userId) {
    throw new UnauthorizedException();
  }
  return userId;
});
