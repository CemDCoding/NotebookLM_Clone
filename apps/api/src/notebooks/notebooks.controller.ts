import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type CreateNotebookRequest,
  CreateNotebookRequestSchema,
  type Notebook,
  type NotebookIdParams,
  NotebookIdParamsSchema,
  type NotebookListResponse,
  type RenameNotebookRequest,
  RenameNotebookRequestSchema,
} from '@notebooklm/shared';
import { CurrentUser } from '../common/decorators';
import { NotebooksService } from './notebooks.service';

/** Notebook endpoints (PE-07). The global Zod pipe validates every argument that names a schema. */
@Controller('notebooks')
export class NotebooksController {
  constructor(private readonly notebooks: NotebooksService) {}

  @Get()
  async list(@CurrentUser() userId: string): Promise<NotebookListResponse> {
    return { notebooks: await this.notebooks.list(userId) };
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body({ schema: CreateNotebookRequestSchema }) body: CreateNotebookRequest,
  ): Promise<Notebook> {
    return this.notebooks.create(userId, body.title);
  }

  @Get(':id')
  get(
    @CurrentUser() userId: string,
    @Param({ schema: NotebookIdParamsSchema }) params: NotebookIdParams,
  ): Promise<Notebook> {
    return this.notebooks.get(userId, params.id);
  }

  @Patch(':id')
  rename(
    @CurrentUser() userId: string,
    @Param({ schema: NotebookIdParamsSchema }) params: NotebookIdParams,
    @Body({ schema: RenameNotebookRequestSchema }) body: RenameNotebookRequest,
  ): Promise<Notebook> {
    return this.notebooks.rename(userId, params.id, body.title);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() userId: string,
    @Param({ schema: NotebookIdParamsSchema }) params: NotebookIdParams,
  ): Promise<void> {
    return this.notebooks.delete(userId, params.id);
  }
}
