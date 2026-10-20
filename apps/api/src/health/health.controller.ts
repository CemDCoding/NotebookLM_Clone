import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { HealthResponse } from '@notebooklm/shared';
import type { Response } from 'express';
import { HealthService } from './health.service';

/**
 * Health check for Railway (apps/api/CLAUDE.md "health"). Public; from M1 on it
 * is marked with `@Public()` so the auth guard lets it through.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // A failed check answers 503 with the health body rather than an error
  // response, so monitoring always sees which dependency is down.
  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const result = await this.health.check();
    res.status(result.database === 'up' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
