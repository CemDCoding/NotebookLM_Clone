import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountModule } from './account/account.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { AllExceptionsFilter, RequestIdMiddleware } from './common/filters';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { AppConfigModule, type Env, type RunModeModules, selectModules } from './config';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { LimitsModule } from './limits/limits.module';
import { LlmModule } from './llm/llm.module';
import { ModelsModule } from './llm/models.module';
import { NotebooksModule } from './notebooks/notebooks.module';
import { QueueModule } from './queue/queue.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { SourcesModule } from './sources/sources.module';
import { StorageModule } from './storage/storage.module';

// Coarse flood protection per IP, in memory (PE-28). The business limits are
// counted in the database and apply on top of this. The German 429 message
// comes from the global exception filter.
export const IP_THROTTLE = { ttl: 60_000, limit: 120 } as const;

// Feature modules by RUN_MODE. Later milestones register their modules here.
// The worker needs the database too and still answers `/health` for Railway.
// Auth loads in every mode, so any controller is protected by default.
// Storage, queue and LLM serve both sides: the API uploads, enqueues and chats,
// the worker downloads, processes jobs and embeds. None of them has a controller.
// Limits load everywhere too: the API checks them, the worker runs their daily
// usage cleanup job.
// Chat and retrieval are HTTP-only: the chat endpoint is the only consumer of
// the vector search, and the worker needs neither. The model list only serves
// the chat picker. The data export is an HTTP download only.
export const RUN_MODE_MODULES: RunModeModules = {
  always: [DbModule, AuthModule, HealthModule, StorageModule, QueueModule, LlmModule, LimitsModule],
  http: [NotebooksModule, SourcesModule, RetrievalModule, ChatModule, ModelsModule, AccountModule],
  worker: [IngestionModule],
};

@Module({})
export class AppModule implements NestModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(env),
        ThrottlerModule.forRoot({ throttlers: [IP_THROTTLE] }),
        ...selectModules(env.RUN_MODE, RUN_MODE_MODULES),
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
