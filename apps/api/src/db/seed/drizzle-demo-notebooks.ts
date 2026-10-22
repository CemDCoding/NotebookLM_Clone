import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db.module';
import { notebooks } from '../schema';
import type { DemoNotebookRepository } from './demo-seed';

@Injectable()
export class DrizzleDemoNotebooks implements DemoNotebookRepository {
  // Named explicitly: the seed runs under tsx, which emits no decorator metadata.
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  replaceAll(userId: string, title: string): Promise<{ deletedIds: string[]; createdId: string }> {
    return this.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(notebooks)
        .where(eq(notebooks.userId, userId))
        .returning({ id: notebooks.id });
      const [created] = await tx
        .insert(notebooks)
        .values({ userId, title })
        .returning({ id: notebooks.id });
      if (!created) {
        throw new Error('Inserting the demo notebook returned no row');
      }
      return { deletedIds: deleted.map((row) => row.id), createdId: created.id };
    });
  }
}
