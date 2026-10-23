import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountRepository } from './account.repository';
import { AccountService } from './account.service';

/**
 * The user's own account: the JSON data export (apps/api/CLAUDE.md
 * "account"). There is no account deletion; the operator manages accounts.
 * Registered only with the HTTP API.
 */
@Module({
  controllers: [AccountController],
  providers: [AccountService, AccountRepository],
})
export class AccountModule {}
