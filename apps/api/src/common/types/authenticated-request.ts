import type { Request } from 'express';

/** The signed-in user, taken from the verified Supabase JWT (`sub`). */
export interface AuthenticatedUser {
  id: string;
}

/**
 * An Express request after the global auth guard has verified the token. The
 * guard sets `user`; handlers read it through `@CurrentUser()`, never from the
 * body or query (apps/api/CLAUDE.md "auth").
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
