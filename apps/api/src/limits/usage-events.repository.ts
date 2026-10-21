import { Injectable } from '@nestjs/common';
import { and, eq, gte } from 'drizzle-orm';
import { usageEventKind, usageEvents } from '../db/schema';
import type { LimitTransaction } from './limit-transactions';

export type UsageEventKind = (typeof usageEventKind.enumValues)[number];

/**
 * Reads and writes the counting log of the usage limits (CLAUDE.md section 4).
 * Every method runs on the caller's transaction, so counting and writing share
 * the lock taken by `LimitTransactions`.
 */
@Injectable()
export class UsageEventsRepository {
  /**
   * Events of `kind` since `since`. Without `userId` it counts all users,
   * which is what the global limits need.
   */
  countSince(
    tx: LimitTransaction,
    kind: UsageEventKind,
    since: Date,
    userId?: string,
  ): Promise<number> {
    return tx.$count(
      usageEvents,
      and(
        eq(usageEvents.kind, kind),
        gte(usageEvents.createdAt, since),
        userId === undefined ? undefined : eq(usageEvents.userId, userId),
      ),
    );
  }

  async insert(tx: LimitTransaction, kind: UsageEventKind, userId: string): Promise<void> {
    await tx.insert(usageEvents).values({ kind, userId });
  }
}
