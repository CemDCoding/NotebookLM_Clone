import { Inject, Injectable } from '@nestjs/common';
import { sourceObjectPath } from '../../storage/storage.service';
import { type Database, DRIZZLE } from '../db.module';
import { sources } from '../schema';
import type { DemoSourceRepository, NewDemoSource } from './demo-seed';

/**
 * Writes the sample source directly instead of going through `SourcesService`:
 * the seed is an operator action, so it neither checks nor consumes the
 * user's upload limits.
 */
@Injectable()
export class DrizzleDemoSources implements DemoSourceRepository {
  // Named explicitly: the seed runs under tsx, which emits no decorator metadata.
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createPending(source: NewDemoSource): Promise<void> {
    await this.db.insert(sources).values({
      ...source,
      // Same rule as uploads: only pasted text leaves the path empty (PE-16).
      storagePath: source.type === 'pasted' ? null : sourceObjectPath(source.userId, source.id),
      status: 'pending',
    });
  }
}
