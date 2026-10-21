/** The claims the API relies on after a token has been verified. */
export interface VerifiedToken {
  /** Supabase user ID, taken from the `sub` claim. */
  sub: string;
}

/**
 * Verifies a bearer token. Behind an interface so the guard can be tested
 * without network access to the Supabase JWKS endpoint.
 *
 * Implementations throw `InvalidTokenError` for any problem with the token
 * itself. Every other error means verification was impossible (e.g. the JWKS
 * endpoint is unreachable) and must not be mistaken for a bad token.
 */
export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken>;
}

/** Injection token for `TokenVerifier`; interfaces do not exist at runtime. */
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

/**
 * The token is malformed, forged, expired or meant for someone else. Carries
 * no reason on purpose: the client only ever learns "401" (CLAUDE.md section 7).
 */
export class InvalidTokenError extends Error {
  constructor() {
    super('Invalid token');
    this.name = 'InvalidTokenError';
  }
}
