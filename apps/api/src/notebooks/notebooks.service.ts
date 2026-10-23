import { Injectable } from '@nestjs/common';
import type { Notebook } from '@notebooklm/shared';
import { NotFoundError } from '../common/errors';
import { LimitsService } from '../limits/limits.service';
import { SourcesService } from '../sources/sources.service';
import { toNotebook } from './notebook.mapper';
import { NotebooksRepository } from './notebooks.repository';

const NOT_FOUND_MESSAGE = 'Das Notebook wurde nicht gefunden.';

@Injectable()
export class NotebooksService {
  constructor(
    private readonly notebooks: NotebooksRepository,
    private readonly limits: LimitsService,
    private readonly sources: SourcesService,
  ) {}

  async list(userId: string): Promise<Notebook[]> {
    const records = await this.notebooks.list(userId);
    return records.map(toNotebook);
  }

  async get(userId: string, id: string): Promise<Notebook> {
    const record = await this.notebooks.findById(userId, id);
    if (!record) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }
    return toNotebook(record);
  }

  async create(userId: string, title: string): Promise<Notebook> {
    await this.limits.assertCanCreateNotebook(userId);
    return toNotebook(await this.notebooks.create(userId, title));
  }

  async rename(userId: string, id: string, title: string): Promise<Notebook> {
    const record = await this.notebooks.rename(userId, id, title);
    if (!record) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }
    return toNotebook(record);
  }

  /**
   * Removes the files of all sources first, then the notebook row; sources
   * and everything below follow by cascade (PE-22). If storage fails, the
   * database stays unchanged and the delete can be retried, so no file is
   * left behind without its source (Art. 17).
   */
  async delete(userId: string, id: string): Promise<void> {
    if (!(await this.notebooks.findById(userId, id))) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }
    await this.sources.removeNotebookFiles(userId, id);
    const deleted = await this.notebooks.delete(userId, id);
    if (!deleted) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }
  }
}
