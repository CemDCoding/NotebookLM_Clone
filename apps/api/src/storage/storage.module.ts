import { Module } from '@nestjs/common';

/**
 * Access to the private Supabase Storage bucket, with paths following
 * `{userId}/{sourceId}` (CLAUDE.md section 7). Filled in by M2-API-02.
 */
@Module({})
export class StorageModule {}
