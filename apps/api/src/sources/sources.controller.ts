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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type CreatePastedSourceRequest,
  CreatePastedSourceRequestSchema,
  type NotebookIdParams,
  NotebookIdParamsSchema,
  type Source,
  type SourceListResponse,
  type SourceParams,
  SourceParamsSchema,
  type UpdateSourceRequest,
  UpdateSourceRequestSchema,
} from '@notebooklm/shared';
import { CurrentUser } from '../common/decorators';
import { createValidationException } from '../common/pipes/zod-validation.pipe';
import { SourcesService } from './sources.service';

/** The multipart field carrying the file (PE-07). */
export const UPLOAD_FIELD = 'file';

/**
 * The parts of multer's file object this controller reads. Declared here
 * because the API's tsconfig only loads the Node typings globally, not the
 * `Express.Multer` namespace.
 */
interface MulterFile {
  originalname: string;
  buffer: Buffer;
}

/**
 * Source endpoints, nested under their notebook (PE-07). The global Zod pipe
 * validates every argument that names a schema; the upload limits come from
 * the module's multer configuration.
 */
@Controller('notebooks/:id/sources')
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}

  @Get()
  async list(
    @CurrentUser() userId: string,
    @Param({ schema: NotebookIdParamsSchema }) params: NotebookIdParams,
  ): Promise<SourceListResponse> {
    return { sources: await this.sources.list(userId, params.id) };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor(UPLOAD_FIELD))
  upload(
    @CurrentUser() userId: string,
    @Param({ schema: NotebookIdParamsSchema }) params: NotebookIdParams,
    @UploadedFile() file: MulterFile | undefined,
  ): Promise<Source> {
    if (!file) {
      throw createValidationException([{ message: 'File is required', path: [UPLOAD_FIELD] }]);
    }
    return this.sources.upload(userId, params.id, {
      originalName: file.originalname,
      content: file.buffer,
    });
  }

  @Post('text')
  addPastedText(
    @CurrentUser() userId: string,
    @Param({ schema: NotebookIdParamsSchema }) params: NotebookIdParams,
    @Body({ schema: CreatePastedSourceRequestSchema }) body: CreatePastedSourceRequest,
  ): Promise<Source> {
    return this.sources.addPastedText(userId, params.id, body.title, body.text);
  }

  @Patch(':sourceId')
  setActive(
    @CurrentUser() userId: string,
    @Param({ schema: SourceParamsSchema }) params: SourceParams,
    @Body({ schema: UpdateSourceRequestSchema }) body: UpdateSourceRequest,
  ): Promise<Source> {
    return this.sources.setActive(userId, params.id, params.sourceId, body.isActive);
  }

  @Delete(':sourceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() userId: string,
    @Param({ schema: SourceParamsSchema }) params: SourceParams,
  ): Promise<void> {
    return this.sources.delete(userId, params.id, params.sourceId);
  }
}
