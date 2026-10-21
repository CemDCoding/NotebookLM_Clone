import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/db.module';

/** The transaction handle the limit repositories run their queries on. */
export type LimitTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Runs a limit check and the write that consumes the limit in one transaction,
 * serialised per limit key (PE-11). Without the lock, two parallel requests
 * could both count the same total and overshoot the limit together.
 */
@Injectable()
export class LimitTransactions {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Takes a transaction-scoped advisory lock per key, then runs `work` with
   * the transaction as its parameter. The locks are released on commit or
   * rollback; a throw from `work` rolls back everything it wrote.
   */
  run<T>(lockKeys: readonly string[], work: (tx: LimitTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      // A fixed order, so two callers taking overlapping keys cannot deadlock.
      for (const key of [...new Set(lockKeys)].sort()) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
      }
      return work(tx);
    });
  }
}
