import { randomUUID } from 'node:crypto';
import { Controller, Get, type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ErrorResponseSchema } from '@notebooklm/shared';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
  type JWTPayload,
  SignJWT,
  UnsecuredJWT,
} from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  JoseTokenVerifier,
  SUPABASE_AUDIENCE,
  supabaseAuthEndpoints,
} from '../src/auth/jose-token-verifier';
import { AuthModule } from '../src/auth/auth.module';
import { TOKEN_VERIFIER, type TokenVerifier } from '../src/auth/token-verifier';
import { CurrentUser } from '../src/common/decorators';
import { AllExceptionsFilter } from '../src/common/filters';
import { DRIZZLE } from '../src/db/db.module';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

// Central guard test (CLAUDE.md section 11): every endpoint relies on this one
// global guard, so its rejections are proven here once, end to end over HTTP,
// with the real jose verifier and a local key set instead of Supabase's JWKS.

const { issuer: ISSUER } = supabaseAuthEndpoints('https://project-ref.supabase.co');
const KEY_ID = 'test-key';
const USER_ID = randomUUID();

@Controller('protected')
class ProtectedController {
  @Get()
  whoAmI(@CurrentUser() userId: string): { userId: string } {
    return { userId };
  }
}

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
// Secrets (Uint8Array) are allowed so a test can forge an HS256 token.
type SigningKey = KeyPair['privateKey'] | Uint8Array;

let projectKey: KeyPair['privateKey'];
let foreignKey: KeyPair['privateKey'];

async function createApp(verifier: TokenVerifier): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AuthModule],
    controllers: [ProtectedController, HealthController],
    providers: [
      HealthService,
      { provide: DRIZZLE, useValue: { execute: () => Promise.resolve([]) } },
    ],
  })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue(verifier)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.useGlobalFilters(new AllExceptionsFilter());
  return app.init();
}

interface TokenOptions {
  key?: SigningKey;
  alg?: string;
  claims?: JWTPayload;
  audience?: string;
  issuer?: string;
  expiresAt?: number | string;
}

function sign({
  key = projectKey,
  alg = 'ES256',
  claims = { sub: USER_ID, role: 'authenticated' },
  audience = SUPABASE_AUDIENCE,
  issuer = ISSUER,
  expiresAt = '1h',
}: TokenOptions = {}): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg, kid: KEY_ID, typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(expiresAt)
    .sign(key);
}

describe('JwtAuthGuard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const projectPair = await generateKeyPair('ES256', { extractable: true });
    projectKey = projectPair.privateKey;
    // A second key with the same `kid` makes a forged signature look plausible.
    foreignKey = (await generateKeyPair('ES256')).privateKey;

    const publicJwk: JWK = {
      ...(await exportJWK(projectPair.publicKey)),
      kid: KEY_ID,
      alg: 'ES256',
    };
    const verifier = new JoseTokenVerifier(createLocalJWKSet({ keys: [publicJwk] }), ISSUER);
    app = await createApp(verifier);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  async function expectUnauthorized(authorization?: string): Promise<void> {
    const req = request(app.getHttpServer()).get('/protected');
    const res = await (authorization === undefined ? req : req.set('Authorization', authorization));

    expect(res.status).toBe(401);
    // Only the generic German message; no hint whether the token was missing, forged or expired.
    expect(ErrorResponseSchema.parse(res.body)).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Bitte melde dich an.',
    });
  }

  it('lets a valid token through and exposes `sub` via @CurrentUser()', async () => {
    const token = await sign();

    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ userId: USER_ID });
  });

  it('accepts the bearer scheme case-insensitively', async () => {
    const token = await sign();

    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `bearer ${token}`)
      .expect(200);
  });

  it('answers 401 without a token', async () => {
    await expectUnauthorized();
  });

  it('answers 401 for another scheme or a malformed header', async () => {
    const token = await sign();

    await expectUnauthorized(`Basic ${token}`);
    await expectUnauthorized('Bearer');
    await expectUnauthorized(`Bearer ${token} extra`);
    await expectUnauthorized('Bearer not-a-jwt');
  });

  it('answers 401 for a token signed with a foreign key', async () => {
    await expectUnauthorized(`Bearer ${await sign({ key: foreignKey })}`);
  });

  it('answers 401 for a token whose payload was altered after signing', async () => {
    const [header, , signature] = (await sign()).split('.');
    const payload = Buffer.from(
      JSON.stringify({
        sub: randomUUID(),
        aud: SUPABASE_AUDIENCE,
        iss: ISSUER,
        exp: 9_999_999_999,
      }),
    ).toString('base64url');

    await expectUnauthorized(`Bearer ${header}.${payload}.${signature}`);
  });

  it('answers 401 for an expired token', async () => {
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;

    await expectUnauthorized(`Bearer ${await sign({ expiresAt: oneMinuteAgo })}`);
  });

  it('answers 401 for a token without expiry', async () => {
    const token = await new SignJWT({ sub: USER_ID })
      .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
      .setIssuer(ISSUER)
      .setAudience(SUPABASE_AUDIENCE)
      .sign(projectKey);

    await expectUnauthorized(`Bearer ${token}`);
  });

  it('answers 401 for a wrong audience, such as an anon token', async () => {
    await expectUnauthorized(`Bearer ${await sign({ audience: 'anon' })}`);
  });

  it('answers 401 for a token of another issuer, such as another Supabase project', async () => {
    const { issuer } = supabaseAuthEndpoints('https://other-project.supabase.co');

    await expectUnauthorized(`Bearer ${await sign({ issuer })}`);
  });

  it('answers 401 for a token without `sub`', async () => {
    await expectUnauthorized(`Bearer ${await sign({ claims: { role: 'authenticated' } })}`);
  });

  it('answers 401 for an unsigned token (`alg: none`)', async () => {
    const token = new UnsecuredJWT({ sub: USER_ID })
      .setIssuer(ISSUER)
      .setAudience(SUPABASE_AUDIENCE)
      .setExpirationTime('1h')
      .encode();

    await expectUnauthorized(`Bearer ${token}`);
  });

  it('answers 401 for an HS256 token signed with a shared secret', async () => {
    const secret = new TextEncoder().encode('legacy-shared-jwt-secret-of-32-bytes!');

    await expectUnauthorized(`Bearer ${await sign({ key: secret, alg: 'HS256' })}`);
  });

  it('keeps GET /health public', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});

describe('JwtAuthGuard when the key set is unreachable', () => {
  let app: INestApplication;
  let error: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const unreachable = new JoseTokenVerifier(() => {
      throw new TypeError('fetch failed: secret-host.supabase.co');
    }, ISSUER);
    app = await createApp(unreachable);
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  // A Supabase outage says nothing about the token. Answering 401 would make
  // the web app sign the user out, so the guard answers 503 instead.
  it('answers 503 without details and does not log the token', async () => {
    const token = await sign();

    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(503);

    expect(ErrorResponseSchema.parse(res.body).message).not.toContain('secret-host');
    expect(JSON.stringify(error.mock.calls)).not.toContain(token);
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret-host');
  });
});

describe('supabaseAuthEndpoints', () => {
  it('derives issuer and JWKS URL from the project URL, with or without trailing slash', () => {
    for (const url of ['https://project-ref.supabase.co', 'https://project-ref.supabase.co/']) {
      const { issuer, jwksUrl } = supabaseAuthEndpoints(url);

      expect(issuer).toBe('https://project-ref.supabase.co/auth/v1');
      expect(jwksUrl.href).toBe('https://project-ref.supabase.co/auth/v1/.well-known/jwks.json');
    }
  });
});
