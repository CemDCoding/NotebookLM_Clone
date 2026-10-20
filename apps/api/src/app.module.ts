import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { AppConfigModule, type Env, type RunModeModules, selectModules } from './config';

// Coarse flood protection per IP, in memory (PE-28). The business limits are
// counted in the database and apply on top of this.
const THROTTLE_TTL_MS = 60_000;
const THROTTLE_LIMIT = 120;

// Feature modules by RUN_MODE. Later milestones register their modules here.
const MODULES: RunModeModules = {
  always: [],
  http: [],
  worker: [],
};

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(env),
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT }],
          errorMessage: 'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.',
        }),
        ...selectModules(env.RUN_MODE, MODULES),
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
      ],
    };
  }
}
