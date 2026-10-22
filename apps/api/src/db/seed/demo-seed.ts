import { randomUUID } from 'node:crypto';
import type { SourceType } from '@notebooklm/shared';

/** Title of the notebook every seed run recreates for the demo account. */
export const DEMO_NOTEBOOK_TITLE = 'Demo: Einführung';

/** Account management through the Supabase Admin API (registration is disabled). */
export interface DemoUserAdmin {
  /** Returns the ID of the user with this email, or `null` if there is none. */
  findUserIdByEmail(email: string): Promise<string | null>;
  /** Creates a confirmed user and returns its ID. */
  createUser(email: string, password: string): Promise<string>;
  /** Sets the password and confirms the email, so a changed password is reset. */
  resetPassword(userId: string, password: string): Promise<void>;
}

export interface DemoNotebookRepository {
  /**
   * Deletes all notebooks of the user and creates one with the given title, in
   * one transaction, so a failed run never leaves the account half reset.
   * Returns the IDs of the deleted notebooks and the new one.
   */
  replaceAll(userId: string, title: string): Promise<{ deletedIds: string[]; createdId: string }>;
}

export interface NewDemoSource {
  id: string;
  notebookId: string;
  userId: string;
  type: SourceType;
  title: string;
}

export interface DemoSourceRepository {
  /** Inserts the source with status `pending`, like an upload before ingestion. */
  createPending(source: NewDemoSource): Promise<void>;
}

/** The part of `StorageService` the seed uses. */
export interface DemoStorage {
  removeAllForUser(userId: string): Promise<void>;
  upload(userId: string, sourceId: string, content: Buffer, contentType: string): Promise<void>;
}

/** The part of `QueueService` the seed uses. */
export interface DemoQueue {
  enqueueIngestion(sourceId: string, userId: string): Promise<void>;
}

export interface DemoSeedLogger {
  log(message: string): void;
}

export interface DemoSeedDeps {
  users: DemoUserAdmin;
  notebooks: DemoNotebookRepository;
  sources: DemoSourceRepository;
  storage: DemoStorage;
  queue: DemoQueue;
  logger: DemoSeedLogger;
}

export interface DemoCredentials {
  email: string;
  password: string;
}

/** The sample file placed in the demo notebook (PE-17). */
export interface DemoSampleSource {
  type: SourceType;
  title: string;
  contentType: string;
  content: Buffer;
}

export interface DemoSeedInput {
  credentials: DemoCredentials;
  sampleSource: DemoSampleSource;
}

export interface DemoSeedResult {
  userId: string;
  userCreated: boolean;
  notebookId: string;
  deletedNotebookCount: number;
  sourceId: string;
}

/**
 * Resets the demo account to its initial state (CLAUDE.md section 7 "Demo-Account"):
 * finds or creates the user, resets the password, removes all of its files,
 * replaces all notebooks with the demo notebook and adds the sample source,
 * which the normal ingestion then processes. Running it twice yields the same
 * state, and a run that failed halfway is repaired by running it again, since
 * every run starts by clearing files and notebooks.
 *
 * Like the upload flow (PE-16): file, then the `pending` row, then the job. No
 * usage event is written: the seed is an operator action, not a user upload.
 * Only IDs and counts are logged, never the email or the password.
 */
export async function seedDemoAccount(
  { credentials, sampleSource }: DemoSeedInput,
  { users, notebooks, sources, storage, queue, logger }: DemoSeedDeps,
): Promise<DemoSeedResult> {
  const existingId = await users.findUserIdByEmail(credentials.email);

  let userId: string;
  if (existingId === null) {
    userId = await users.createUser(credentials.email, credentials.password);
    logger.log(`Created demo user ${userId}`);
  } else {
    userId = existingId;
    // A new user already has the password; an existing one may have changed it.
    await users.resetPassword(userId, credentials.password);
    logger.log(`Reused demo user ${userId}, password reset`);
  }

  // Files first, as when deleting a notebook (PE-22): the notebook cascade
  // removes rows and chunks, but never storage objects.
  await storage.removeAllForUser(userId);
  logger.log(`Removed all storage files of demo user ${userId}`);

  const { deletedIds, createdId } = await notebooks.replaceAll(userId, DEMO_NOTEBOOK_TITLE);
  logger.log(`Deleted ${deletedIds.length} notebook(s), created demo notebook ${createdId}`);

  const sourceId = randomUUID();
  await storage.upload(userId, sourceId, sampleSource.content, sampleSource.contentType);
  await sources.createPending({
    id: sourceId,
    notebookId: createdId,
    userId,
    type: sampleSource.type,
    title: sampleSource.title,
  });
  await queue.enqueueIngestion(sourceId, userId);
  logger.log(`Created sample source ${sourceId} in notebook ${createdId}, ingestion queued`);

  return {
    userId,
    userCreated: existingId === null,
    notebookId: createdId,
    deletedNotebookCount: deletedIds.length,
    sourceId,
  };
}
