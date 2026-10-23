import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppConfigService, EnvValidationError, loadEnv } from './config';
import { configureHttpApp } from './http-app';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env));
  const config = app.get(AppConfigService);

  configureHttpApp(app, config);
  // By default Nest re-raises the signal after the shutdown hooks. Started with
  // `exec` on Railway, Node may run as PID 1, and the kernel ignores a re-raised
  // SIGTERM there. Exiting explicitly ends the process with code 0 either way
  // (docs/security-checklist.md, shutdown).
  app.enableShutdownHooks([], { useProcessExit: true });

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
