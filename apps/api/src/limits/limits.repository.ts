import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/db.module';
import { notebooks } from '../db/schema';

/** Counts the rows the stock limits are checked against (apps/api/CLAUDE.md "limits"). */
@Injectable()
export class LimitsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  countNotebooks(userId: string): Promise<number> {
    return this.db.$count(notebooks, eq(notebooks.userId, userId));
  }
}
