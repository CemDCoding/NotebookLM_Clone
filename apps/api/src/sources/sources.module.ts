import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AppConfigService } from '../config';
import { LimitsModule } from '../limits/limits.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { SourcesController } from './sources.controller';
import { SourcesRepository } from './sources.repository';
import { SourcesService } from './sources.service';
import { uploadOptions } from './upload-options';

/**
 * Upload, pasted text, list, toggle and delete of sources
 * (apps/api/CLAUDE.md "sources und ingestion"). A new source is handed to
 * the ingestion queue. Exports the service so that deleting a notebook can
 * remove its source files first (PE-22).
 */
@Module({
  imports: [
    LimitsModule,
    QueueModule,
    StorageModule,
    MulterModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => uploadOptions(config.limits.maxFileSizeBytes),
    }),
  ],
  controllers: [SourcesController],
  providers: [SourcesService, SourcesRepository],
  exports: [SourcesService],
})
export class SourcesModule {}
