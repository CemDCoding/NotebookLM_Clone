import { Module } from '@nestjs/common';
import { LimitsModule } from '../limits/limits.module';
import { NotebooksController } from './notebooks.controller';
import { NotebooksRepository } from './notebooks.repository';
import { NotebooksService } from './notebooks.service';

/** Notebook CRUD, scoped to the signed-in user. */
@Module({
  imports: [LimitsModule],
  controllers: [NotebooksController],
  providers: [NotebooksService, NotebooksRepository],
})
export class NotebooksModule {}
