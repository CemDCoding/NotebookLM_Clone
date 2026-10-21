import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { InvalidTokenError, type TokenVerifier, type VerifiedToken } from './token-verifier';

/** Supabase issues user tokens only for this audience; anon tokens carry another one. */
export const SUPABASE_AUDIENCE = 'authenticated';

// The project uses asymmetric signing keys (apps/api/CLAUDE.md "auth"). Pinning
// the algorithms rejects `alg: none` and HS256 tokens signed with a shared secret.
const ALLOWED_ALGORITHMS = ['ES256', 'RS256'];

/** Where Supabase Auth publishes its keys and which issuer its tokens carry. */
export function supabaseAuthEndpoints(supabaseUrl: string): { issuer: string; jwksUrl: URL } {
  // `SUPABASE_URL` may end with a slash; the issuer claim never contains a double one.
  const issuer = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
  return { issuer, jwksUrl: new URL(`${issuer}/.well-known/jwks.json`) };
}

/** Verifies signature, issuer, audience and expiry of Supabase JWTs with `jose`. */
export class JoseTokenVerifier implements TokenVerifier {
  constructor(
    private readonly keys: JWTVerifyGetKey,
    private readonly issuer: string,
  ) {}

  /** Production setup: keys come from the project's JWKS, cached and refreshed by `jose`. */
  static forSupabase(supabaseUrl: string): JoseTokenVerifier {
    const { issuer, jwksUrl } = supabaseAuthEndpoints(supabaseUrl);
    return new JoseTokenVerifier(createRemoteJWKSet(jwksUrl), issuer);
  }

  async verify(token: string): Promise<VerifiedToken> {
    let sub: unknown;
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.issuer,
        audience: SUPABASE_AUDIENCE,
        algorithms: ALLOWED_ALGORITHMS,
        requiredClaims: ['exp', 'sub'],
      });
      sub = payload.sub;
    } catch (error) {
      throw isKeySetUnavailable(error) ? error : new InvalidTokenError();
    }
    if (typeof sub !== 'string' || sub.length === 0) {
      throw new InvalidTokenError();
    }
    return { sub };
  }
}

/**
 * A timeout, an unusable JWKS response or a network failure says nothing about
 * the token. Passing it on lets the guard answer 503 instead of 401, so the
 * web app does not sign users out during a Supabase outage.
 */
function isKeySetUnavailable(error: unknown): boolean {
  if (error instanceof errors.JWKSTimeout || error instanceof errors.JWKSInvalid) {
    return true;
  }
  return !(error instanceof errors.JOSEError);
}
