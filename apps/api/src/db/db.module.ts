import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { AppConfigService } from '../config';
import * as schema from './schema';

/** Injection token of the Drizzle client: `@Inject(DRIZZLE) db: Database`. */
export const DRIZZLE = Symbol('DRIZZLE');
const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

export type Database = PostgresJsDatabase<typeof schema>;

// Supabase Free limits the connections of the session pooler, which Drizzle
// shares with pg-boss (PE-12: Drizzle 5, pg-boss 3).
const POOL_MAX = 5;
// Fail fast instead of postgres.js' 30 s default, so `/health` reports a broken
// connection while Railway's health check is still waiting.
const CONNECT_TIMEOUT_SECONDS = 10;
const SHUTDOWN_TIMEOUT_SECONDS = 5;

/**
 * Provides the Drizzle client to all modules. postgres.js connects lazily on
 * the first query, so a wrong `DATABASE_URL` does not stop the start;
 * `/health` reports it instead. The pool is closed on shutdown.
 */
@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Sql =>
        postgres(config.databaseUrl, {
          max: POOL_MAX,
          connect_timeout: CONNECT_TIMEOUT_SECONDS,
          // The default writes server notices to the console; they carry no value here.
          onnotice: () => undefined,
        }),
    },
    {
      provide: DRIZZLE,
      inject: [POSTGRES_CLIENT],
      useFactory: (client: Sql): Database => drizzle(client, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(POSTGRES_CLIENT) private readonly client: Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: SHUTDOWN_TIMEOUT_SECONDS });
  }
}
