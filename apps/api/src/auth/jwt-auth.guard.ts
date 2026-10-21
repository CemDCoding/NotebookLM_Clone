import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/decorators';
import type { AuthenticatedRequest } from '../common/types';
import { InvalidTokenError, TOKEN_VERIFIER, type TokenVerifier } from './token-verifier';

// RFC 6750: the scheme is case-insensitive, the token itself contains no spaces.
const BEARER_PATTERN = /^Bearer ([^\s]+)$/i;

/**
 * Global guard (registered via `APP_GUARD` in `AuthModule`): every route needs
 * a valid Supabase JWT unless it is marked `@Public()` (CLAUDE.md section 7).
 * On success it stores the user on the request for `@CurrentUser()`.
 *
 * Every rejection is a bare 401; the reason (missing, expired, forged, wrong
 * audience) is neither sent nor logged, and the token is never logged.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = bearerToken(request);
    if (token === undefined) {
      throw new UnauthorizedException();
    }

    try {
      const { sub } = await this.verifier.verify(token);
      (request as AuthenticatedRequest).user = { id: sub };
      return true;
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw new UnauthorizedException();
      }
      this.logger.error({
        message: 'Token verification unavailable',
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw new ServiceUnavailableException();
    }
  }
}

function bearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  return header === undefined ? undefined : BEARER_PATTERN.exec(header)?.[1];
}
