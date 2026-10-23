import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { AppConfigService } from './config';

// Pasted text may have 500,000 characters; 2 MB covers that even with multi-byte
// characters, while Express' default of 100 KB would reject it (apps/api/CLAUDE.md "Body-Limits").
export const JSON_BODY_LIMIT = '2mb';

/**
 * The HTTP hardening of the API (CLAUDE.md section 7 "Härtung"): proxy trust
 * for the per-IP throttler, security headers, CORS for the web origin only and
 * the JSON body limit. Kept apart from `main.ts` so a test can apply exactly
 * this setup to an app without a database.
 */
export function configureHttpApp(
  app: NestExpressApplication,
  config: Pick<AppConfigService, 'webOrigin'>,
): void {
  // Railway forwards requests through one proxy hop. Trusting exactly that hop makes
  // `req.ip` the client address, which the per-IP throttler keys on, while a client
  // still cannot spoof it with its own X-Forwarded-For header.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: config.webOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    // Lets the web app read the request ID, so an error message can show it for support.
    exposedHeaders: ['X-Request-Id'],
  });
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
}
