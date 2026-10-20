import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService, EnvValidationError, loadEnv } from './config';

// Pasted text may have 500,000 characters; 2 MB covers that even with multi-byte
// characters, while Express' default of 100 KB would reject it (apps/api/CLAUDE.md "Body-Limits").
const JSON_BODY_LIMIT = '2mb';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env));
  const config = app.get(AppConfigService);

  // Railway forwards requests through one proxy hop. Trusting exactly that hop makes
  // `req.ip` the client address, which the per-IP throttler keys on, while a client
  // still cannot spoof it with its own X-Forwarded-For header.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: config.webOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.enableShutdownHooks();

  await app.listen(config.port);
  logger.log(`API listening on port ${config.port} (RUN_MODE=${config.runMode})`);
}

bootstrap().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    logger.error(error.message);
  } else {
    logger.error('API failed to start', error instanceof Error ? error.stack : String(error));
  }
  process.exit(1);
});
