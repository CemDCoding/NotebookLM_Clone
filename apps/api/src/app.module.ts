import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter, RequestIdMiddleware } from './common/filters';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { AppConfigModule, type Env, type RunModeModules, selectModules } from './config';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { LimitsModule } from './limits/limits.module';
import { NotebooksModule } from './notebooks/notebooks.module';

// Coarse flood protection per IP, in memory (PE-28). The business limits are
// counted in the database and apply on top of this. The German 429 message
// comes from the global exception filter.
const THROTTLE_TTL_MS = 60_000;
const THROTTLE_LIMIT = 120;

// Feature modules by RUN_MODE. Later milestones register their modules here.
// The worker needs the database too and still answers `/health` for Railway.
// Auth loads in every mode, so any controller is protected by default.
const MODULES: RunModeModules = {
  always: [DbModule, AuthModule, HealthModule],
  http: [LimitsModule, NotebooksModule],
  worker: [],
};

@Module({})
export class AppModule implements NestModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(env),
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT }],
        }),
        ...selectModules(env.RUN_MODE, MODULES),
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}
