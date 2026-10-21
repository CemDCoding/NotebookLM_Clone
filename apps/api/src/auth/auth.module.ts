import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigService } from '../config';
import { JoseTokenVerifier } from './jose-token-verifier';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TOKEN_VERIFIER } from './token-verifier';

/**
 * Verifies Supabase JWTs with a global guard (apps/api/CLAUDE.md "auth").
 * Registering the guard here instead of in `app.module.ts` protects every
 * controller as soon as this module is loaded, which happens in every RUN_MODE.
 */
@Module({
  providers: [
    {
      provide: TOKEN_VERIFIER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => JoseTokenVerifier.forSupabase(config.supabaseUrl),
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
