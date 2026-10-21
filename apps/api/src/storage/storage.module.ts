import { Module } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { AppConfigService } from '../config';
import { STORAGE_CLIENT, type StorageClient, StorageService } from './storage.service';

/**
 * Access to the private Supabase Storage bucket, with paths following
 * `{userId}/{sourceId}` (CLAUDE.md section 7). The bucket has no policies; only
 * the API reaches it, with the service-role key that never leaves the backend.
 */
@Module({
  providers: [
    {
      provide: STORAGE_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): StorageClient =>
        createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
          // A server-side service client: no user session to keep or refresh.
          auth: { autoRefreshToken: false, persistSession: false },
        }).storage,
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
