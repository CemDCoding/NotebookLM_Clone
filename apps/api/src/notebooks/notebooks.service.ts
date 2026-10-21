import { Injectable } from '@nestjs/common';
import type { Notebook } from '@notebooklm/shared';
import { NotFoundError } from '../common/errors';
import { LimitsService } from '../limits/limits.service';
import { toNotebook } from './notebook.mapper';
import { NotebooksRepository } from './notebooks.repository';

const NOT_FOUND_MESSAGE = 'Das Notebook wurde nicht gefunden.';

@Injectable()
export class NotebooksService {
  constructor(
    private readonly notebooks: NotebooksRepository,
    private readonly limits: LimitsService,
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

  async delete(userId: string, id: string): Promise<void> {
    const deleted = await this.notebooks.delete(userId, id);
    if (!deleted) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }
  }
}
