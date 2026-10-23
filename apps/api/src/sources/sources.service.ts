import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Source, SourceType } from '@notebooklm/shared';
import { NotFoundError, PayloadTooLargeError } from '../common/errors';
import { AppConfigService } from '../config';
import { LimitsService } from '../limits/limits.service';
import { QueueService } from '../queue/queue.service';
import { sourceObjectPath, StorageService } from '../storage/storage.service';
import { contentTypeFor, countPdfPages, detectFileType } from './file-validation';
import { toSource } from './source.mapper';
import { titleFromFilename } from './source-title';
import { type NewSourceRecord, type SourceRecord, SourcesRepository } from './sources.repository';

const NOTEBOOK_NOT_FOUND_MESSAGE = 'Das Notebook wurde nicht gefunden.';
const SOURCE_NOT_FOUND_MESSAGE = 'Die Quelle wurde nicht gefunden.';

/** An uploaded file as the controller hands it over, already size-limited while reading. */
export interface UploadedSourceFile {
  /** The client's file name: untrusted, only used for the title and the text/markdown distinction. */
  originalName: string;
  content: Buffer;
}

/** A source that has passed all checks and is ready to be stored. */
interface AcceptedSource {
  type: SourceType;
  title: string;
  content: Buffer;
}

/**
 * Sources of a notebook: upload, pasted text, list, toggle and delete
 * (apps/api/CLAUDE.md "sources und ingestion"). Every action first checks
 * that the notebook belongs to the user, so another user's notebook or source
 * answers `404` like a missing one.
 */
@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    private readonly sources: SourcesRepository,
    private readonly storage: StorageService,
    private readonly limits: LimitsService,
    private readonly config: AppConfigService,
    private readonly queue: QueueService,
  ) {}

  async list(userId: string, notebookId: string): Promise<Source[]> {
    await this.assertNotebookOwned(userId, notebookId);
    const records = await this.sources.list(userId, notebookId);
    return records.map(toSource);
  }

  /**
   * Adds an uploaded file (PE-16): ownership, then type by content and PDF
   * pages, then the limits, and only then storage and database. A rejected
   * file therefore never uses up the daily upload quota.
   */
  async upload(userId: string, notebookId: string, file: UploadedSourceFile): Promise<Source> {
    await this.assertNotebookOwned(userId, notebookId);
    const type = detectFileType(file.content, file.originalName);
    if (type === 'pdf') {
      await this.assertPdfPageLimit(file.content);
    }
    return this.store(userId, notebookId, {
      type,
      title: titleFromFilename(file.originalName),
      content: file.content,
    });
  }

  /**
   * Adds pasted text. It is stored as a UTF-8 file under the same path scheme
   * as uploads, so ingestion has one extraction path for every source and
   * deleting always removes exactly one file (PE-16).
   */
  async addPastedText(
    userId: string,
    notebookId: string,
    title: string,
    text: string,
  ): Promise<Source> {
    await this.assertNotebookOwned(userId, notebookId);
    // The shared schema caps the text at the default limit; a lower limit
    // configured via MAX_PASTED_TEXT_CHARS is enforced here.
    const maxChars = this.config.limits.maxPastedTextChars;
    if (text.length > maxChars) {
      throw new PayloadTooLargeError(
        `Der Text ist zu lang. Erlaubt sind höchstens ${maxChars.toLocaleString('de-DE')} Zeichen.`,
      );
    }
    return this.store(userId, notebookId, {
      type: 'pasted',
      title,
      content: Buffer.from(text, 'utf8'),
    });
  }

  async setActive(
    userId: string,
    notebookId: string,
    sourceId: string,
    isActive: boolean,
  ): Promise<Source> {
    const record = await this.sources.setActive(userId, notebookId, sourceId, isActive);
    if (!record) {
      throw new NotFoundError(SOURCE_NOT_FOUND_MESSAGE);
    }
    return toSource(record);
  }

  /**
   * Deletes the file first, then the row (PE-22). If storage fails, the row
   * stays and the user can retry; no file is ever left without its source.
   */
  async delete(userId: string, notebookId: string, sourceId: string): Promise<void> {
    const record = await this.sources.findById(userId, notebookId, sourceId);
    if (!record) {
      throw new NotFoundError(SOURCE_NOT_FOUND_MESSAGE);
    }
    await this.storage.remove(userId, [sourceId]);
    // Missing means a parallel delete finished first; the result is the same.
    await this.sources.delete(userId, notebookId, sourceId);
    this.logger.log({ message: 'Source deleted', sourceId, notebookId });
  }

  /**
   * Removes the files of all sources of a notebook, for deleting the notebook
   * (PE-22). Rows are left to the notebook's cascade. For a notebook the user
   * does not own it finds no sources and removes nothing.
   */
  async removeNotebookFiles(userId: string, notebookId: string): Promise<void> {
    const sourceIds = await this.sources.listIds(userId, notebookId);
    await this.storage.remove(userId, sourceIds);
  }

  private async assertNotebookOwned(userId: string, notebookId: string): Promise<void> {
    if (!(await this.sources.notebookExists(userId, notebookId))) {
      throw new NotFoundError(NOTEBOOK_NOT_FOUND_MESSAGE);
    }
  }

  private async assertPdfPageLimit(content: Buffer): Promise<void> {
    const maxPages = this.config.limits.maxPdfPages;
    const pages = await countPdfPages(content);
    if (pages > maxPages) {
      throw new PayloadTooLargeError(
        `Die PDF-Datei hat ${pages} Seiten. Erlaubt sind höchstens ${maxPages} Seiten. Bitte teile sie auf.`,
      );
    }
  }

  /**
   * Consumes the upload quota, writes the file and the `pending` row, then
   * enqueues the ingestion job (PE-16).
   */
  private async store(
    userId: string,
    notebookId: string,
    accepted: AcceptedSource,
  ): Promise<Source> {
    await this.limits.acceptUpload(userId, notebookId);

    const sourceId = randomUUID();
    await this.storage.upload(userId, sourceId, accepted.content, contentTypeFor(accepted.type));

    const values: NewSourceRecord = {
      id: sourceId,
      notebookId,
      userId,
      type: accepted.type,
      title: accepted.title,
      // Pasted text has a file too, but §4 keeps its path empty: it follows from the scheme (PE-16).
      storagePath: accepted.type === 'pasted' ? null : sourceObjectPath(userId, sourceId),
    };
    let record: SourceRecord;
    try {
      record = await this.sources.create(values);
    } catch (error) {
      // E.g. the notebook was deleted in the meantime. Without the row nothing
      // would ever delete the file, so it goes now.
      await this.removeOrphanedFile(userId, sourceId);
      throw error;
    }

    try {
      await this.queue.enqueueIngestion(sourceId, userId);
    } catch (error) {
      // Without a job the source would stay `pending` forever. Undoing it lets
      // the user simply upload again; the quota stays used, like any accepted upload.
      await this.discardUnqueuedSource(userId, notebookId, sourceId);
      throw error;
    }

    this.logger.log({ message: 'Source created', sourceId, notebookId, type: accepted.type });
    return toSource(record);
  }

  /** File first, then the row, like a normal delete (PE-22). */
  private async discardUnqueuedSource(
    userId: string,
    notebookId: string,
    sourceId: string,
  ): Promise<void> {
    try {
      await this.storage.remove(userId, [sourceId]);
      await this.sources.delete(userId, notebookId, sourceId);
    } catch (error) {
      // The enqueue failure is what the client sees. A source left behind
      // shows as `pending` and can be deleted by the user.
      this.logger.error({
        message: 'Failed to discard a source whose ingestion was not queued',
        sourceId,
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
    }
  }

  private async removeOrphanedFile(userId: string, sourceId: string): Promise<void> {
    try {
      await this.storage.remove(userId, [sourceId]);
    } catch (error) {
      // The original failure is what the client sees; this one is only logged,
      // by class, so the leftover file can be found and removed by hand.
      this.logger.error({
        message: 'Failed to remove the file of a source that was not saved',
        sourceId,
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
    }
  }
}
