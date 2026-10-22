import { type DynamicModule, Module } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { AppConfigModule, AppConfigService, type Env } from '../../config';
import { QueueModule } from '../../queue/queue.module';
import { StorageModule } from '../../storage/storage.module';
import { DbModule } from '../db.module';
import { DrizzleDemoNotebooks } from './drizzle-demo-notebooks';
import { DrizzleDemoSources } from './drizzle-demo-sources';
import { SupabaseUserAdmin } from './supabase-user-admin';

/**
 * The seed's Nest application context (apps/api/CLAUDE.md "seed"): config,
 * database, storage and queue, without HTTP and without the ingestion worker.
 * The seed runs under tsx, which emits no decorator metadata, so every
 * provider here names its dependencies via `@Inject` or `inject`.
 */
@Module({})
export class SeedModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: SeedModule,
      imports: [AppConfigModule.forRoot(env), DbModule, StorageModule, QueueModule],
      providers: [
        DrizzleDemoNotebooks,
        DrizzleDemoSources,
        {
          provide: SupabaseUserAdmin,
          inject: [AppConfigService],
          useFactory: (config: AppConfigService): SupabaseUserAdmin =>
            new SupabaseUserAdmin(
              createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
                // A one-off admin script: no session to keep or refresh.
                auth: { autoRefreshToken: false, persistSession: false },
              }),
            ),
        },
      ],
    };
  }
}
