import { type CustomDecorator, SetMetadata } from '@nestjs/common';

/** Metadata key the auth guard reads to skip token verification. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route or controller as reachable without a token. Every other
 * endpoint requires a valid Supabase JWT (CLAUDE.md section 7), so this is
 * the only way to opt out; today only `GET /health` uses it.
 */
export const Public = (): CustomDecorator<typeof IS_PUBLIC_KEY> => SetMetadata(IS_PUBLIC_KEY, true);
