import { type DynamicModule, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import type { Env } from './env.schema';

/**
 * Provides the validated configuration everywhere. It takes the already
 * validated `Env` because RUN_MODE decides which modules exist, so the
 * environment must be known before Nest builds the module graph.
 */
@Module({})
export class AppConfigModule {
  static forRoot(env: Env): DynamicModule {
    return {
      global: true,
      module: AppConfigModule,
      providers: [{ provide: AppConfigService, useValue: new AppConfigService(env) }],
      exports: [AppConfigService],
    };
  }
}
