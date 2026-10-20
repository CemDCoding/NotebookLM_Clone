import { Inject, Injectable, Logger } from '@nestjs/common';
import type { HealthResponse } from '@notebooklm/shared';
import { sql } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/db.module';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok', database: 'up' };
    } catch (error) {
      // Only the class: driver messages can contain host names or connection details.
      this.logger.warn({
        message: 'Database check failed',
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
      return { status: 'error', database: 'down' };
    }
  }
}
