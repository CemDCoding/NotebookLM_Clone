import { Controller, Get, Res } from '@nestjs/common';
import type { DataExport } from '@notebooklm/shared';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators';
import { AccountService } from './account.service';
import { exportFileName } from './export-file-name';

/** Endpoints about the signed-in user's own account (PE-07). */
@Controller('me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /**
   * The data export as a JSON download. The headers are set only once the
   * export exists, so an error still leaves as a normal JSON error response.
   * `no-store` keeps the personal data out of browser and proxy caches.
   */
  @Get('export')
  async export(
    @CurrentUser() userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DataExport> {
    const data = await this.account.export(userId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportFileName(data.exportedAt)}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    return data;
  }
}
