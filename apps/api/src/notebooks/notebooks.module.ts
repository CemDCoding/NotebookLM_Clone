import { Module } from '@nestjs/common';
import { LimitsModule } from '../limits/limits.module';
import { SourcesModule } from '../sources/sources.module';
import { NotebooksController } from './notebooks.controller';
import { NotebooksRepository } from './notebooks.repository';
import { NotebooksService } from './notebooks.service';

/**
 * Notebook CRUD, scoped to the signed-in user. Uses the sources module to
 * remove a notebook's files before the notebook itself is deleted (PE-22).
 */
@Module({
  imports: [LimitsModule, SourcesModule],
  controllers: [NotebooksController],
  providers: [NotebooksService, NotebooksRepository],
})
export class NotebooksModule {}
