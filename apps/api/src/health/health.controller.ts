import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { HealthResponse } from '@notebooklm/shared';
import type { Response } from 'express';
import { Public } from '../common/decorators';
import { HealthService } from './health.service';

/**
 * Health check for Railway (apps/api/CLAUDE.md "health"). The only public
 * endpoint: Railway's health check sends no token.
 */
@Public()
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
