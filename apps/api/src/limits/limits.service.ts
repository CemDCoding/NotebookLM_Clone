import { Injectable } from '@nestjs/common';
import { LimitExceededError } from '../common/errors';
import { AppConfigService } from '../config';
import { startOfBerlinDay } from './berlin-day';
import { LimitTransactions } from './limit-transactions';
import { LimitsRepository } from './limits.repository';
import { SourceCountsRepository } from './source-counts.repository';
import { UsageEventsRepository } from './usage-events.repository';

/** Advisory-lock key of the global daily upload limit (PE-11). */
export const GLOBAL_UPLOAD_LOCK_KEY = 'limits:upload:global';

/**
 * Central check of all business limits (apps/api/CLAUDE.md "limits"). Services
 * call it before the action; a reached limit throws `LimitExceededError`, which
 * the exception filter turns into `429` with a displayable German message.
 */
@Injectable()
export class LimitsService {
  constructor(
    private readonly repository: LimitsRepository,
    private readonly config: AppConfigService,
    private readonly transactions: LimitTransactions,
    private readonly sourceCounts: SourceCountsRepository,
    private readonly usageEvents: UsageEventsRepository,
  ) {}

  /**
   * Stock limit: counts the user's existing notebooks, so deleting one frees a
   * slot. Two parallel requests right at the limit may both pass. For a
   * per-user stock limit that overshoot by one is acceptable, unlike the usage
   * limits, which check and write in one transaction.
   */
  async assertCanCreateNotebook(userId: string): Promise<void> {
    const max = this.config.limits.maxNotebooksPerUser;
    const count = await this.repository.countNotebooks(userId);
    if (count >= max) {
      throw new LimitExceededError(
        `Du kannst höchstens ${max} Notebooks anlegen. Lösche ein Notebook, um ein neues anzulegen.`,
      );
    }
  }

  /**
   * Accepts an upload into a notebook the caller has already checked
   * ownership of, and records it as a usage event (PE-16). Checking and
   * writing run in one locked transaction, so parallel uploads cannot exceed
   * the global daily limit together.
   *
   * The source stock is counted in the same transaction, but the source row
   * itself is written later, after the file is in storage (PE-16). Parallel
   * uploads into one notebook at its limit may therefore both pass. As with
   * the notebook limit, that overshoot within one user's own notebook is
   * accepted, so the lock is not held across the storage upload.
   *
   * Deleting sources frees stock but never returns the daily quota: the usage
   * event has no link to the source (CLAUDE.md section 7).
   */
  async acceptUpload(userId: string, notebookId: string): Promise<void> {
    const { maxSourcesPerNotebook, uploadsGlobalPerDay } = this.config.limits;
    await this.transactions.run([GLOBAL_UPLOAD_LOCK_KEY], async (tx) => {
      const sourceCount = await this.sourceCounts.countSources(tx, userId, notebookId);
      if (sourceCount >= maxSourcesPerNotebook) {
        throw new LimitExceededError(
          `Ein Notebook kann höchstens ${maxSourcesPerNotebook} Quellen enthalten. Lösche eine Quelle, um eine neue hinzuzufügen.`,
        );
      }

      const uploadsToday = await this.usageEvents.countSince(
        tx,
        'upload',
        startOfBerlinDay(new Date()),
      );
      if (uploadsToday >= uploadsGlobalPerDay) {
        throw new LimitExceededError(
          `Die Demo hat ihr Tageslimit von ${uploadsGlobalPerDay} Uploads erreicht. Bitte versuche es morgen erneut.`,
        );
      }

      await this.usageEvents.insert(tx, 'upload', userId);
    });
  }
}
