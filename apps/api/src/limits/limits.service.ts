import { Injectable } from '@nestjs/common';
import { LimitExceededError } from '../common/errors';
import { AppConfigService } from '../config';
import { LimitsRepository } from './limits.repository';

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
}
