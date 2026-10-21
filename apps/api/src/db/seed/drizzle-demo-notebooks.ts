import { eq } from 'drizzle-orm';
import type { Database } from '../db.module';
import { notebooks } from '../schema';
import type { DemoNotebookRepository } from './demo-seed';

export class DrizzleDemoNotebooks implements DemoNotebookRepository {
  constructor(private readonly db: Database) {}

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
