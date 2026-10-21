import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { sources } from '../db/schema';
import type { LimitTransaction } from './limit-transactions';

/**
 * Counts the rows the source stock limit is checked against. Kept apart from
 * `LimitsRepository` because this count runs on the caller's transaction.
 */
@Injectable()
export class SourceCountsRepository {
  countSources(tx: LimitTransaction, userId: string, notebookId: string): Promise<number> {
    return tx.$count(sources, and(eq(sources.userId, userId), eq(sources.notebookId, notebookId)));
  }
}
