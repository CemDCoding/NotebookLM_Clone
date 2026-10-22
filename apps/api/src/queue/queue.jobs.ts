/** Turns an uploaded source into embedded chunks (apps/api/CLAUDE.md "sources und ingestion"). */
export const INGEST_SOURCE_QUEUE = 'ingest-source';
/** Deletes `usage_events` older than 7 days (apps/api/CLAUDE.md "limits"). */
export const CLEANUP_USAGE_EVENTS_QUEUE = 'cleanup-usage-events';

export const QUEUE_NAMES = [INGEST_SOURCE_QUEUE, CLEANUP_USAGE_EVENTS_QUEUE] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

/**
 * Payload of an `ingest-source` job. Only IDs, never content: pg-boss stores
 * the payload in its tables. The worker loads the source with `userId`, so
 * it goes through the same per-user filter as every other query.
 */
export interface IngestSourceJob {
  sourceId: string;
  userId: string;
}
