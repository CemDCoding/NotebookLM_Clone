import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

/** The private bucket holding all source files (docs/deployment.md, "Storage"). */
export const SOURCES_BUCKET = 'sources';

/** Injection token of the Supabase Storage client authenticated with the service-role key. */
export const STORAGE_CLIENT = Symbol('STORAGE_CLIENT');

/** Only the storage part of the Supabase client, so tests fake just that. */
export type StorageClient = SupabaseClient['storage'];

// Supabase Storage removes at most 1,000 objects per request, and listing uses
// the same page size so one page maps to one removal.
const BATCH_SIZE = 1000;

const IdSchema = z.uuid();

/**
 * A storage request failed. Carries only the action and the provider's status,
 * never its message: that may echo paths and thus user IDs, and the exception
 * filter must be able to log the class without leaking anything (PE-29).
 */
export class StorageOperationError extends Error {
  constructor(action: string, error: { name: string; status?: number; statusCode?: string }) {
    const details = [error.name, error.status, error.statusCode].filter(
      (part) => part !== undefined,
    );
    super(`Storage failed to ${action} (${details.join(', ')})`);
    this.name = 'StorageOperationError';
  }
}

/**
 * Builds the object path `{userId}/{sourceId}` (CLAUDE.md section 7). Both
 * parts must be UUIDs, so no input can reach another user's folder through
 * `..`, slashes or an empty segment, even if a caller passes something
 * unchecked by mistake.
 */
export function sourceObjectPath(userId: string, sourceId: string): string {
  return `${assertId(userId)}/${assertId(sourceId)}`;
}

function assertId(id: string): string {
  if (!IdSchema.safeParse(id).success) {
    // A programming error, not a user error: callers only pass IDs from the
    // verified token and from the database.
    throw new Error('Storage path segments must be UUIDs');
  }
  return id;
}

/**
 * Access to the private `sources` bucket. Callers pass IDs, never paths: every
 * path is built here, so the scheme `{userId}/{sourceId}` and the tenant
 * separation hold in exactly one place.
 */
@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE_CLIENT) private readonly client: StorageClient) {}

  /** Stores a new source file. Overwriting is refused: a source ID is only ever uploaded once. */
  async upload(
    userId: string,
    sourceId: string,
    content: Buffer,
    contentType: string,
  ): Promise<void> {
    const { error } = await this.bucket().upload(sourceObjectPath(userId, sourceId), content, {
      contentType,
      upsert: false,
    });
    if (error) {
      throw new StorageOperationError('upload a source file', error);
    }
  }

  async download(userId: string, sourceId: string): Promise<Buffer> {
    const { data, error } = await this.bucket().download(sourceObjectPath(userId, sourceId));
    if (error) {
      throw new StorageOperationError('download a source file', error);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  /**
   * Removes the files of the given sources. Missing files count as removed, so
   * a delete that failed after this step can simply be retried (PE-22).
   */
  async remove(userId: string, sourceIds: readonly string[]): Promise<void> {
    const paths = sourceIds.map((sourceId) => sourceObjectPath(userId, sourceId));
    await this.removePaths(paths);
  }

  /** Removes every file of a user, e.g. before the operator deletes the account. */
  async removeAllForUser(userId: string): Promise<void> {
    const folder = assertId(userId);
    const paths = (await this.listNames(folder)).map((name) => `${folder}/${name}`);
    await this.removePaths(paths);
  }

  private async listNames(folder: string): Promise<string[]> {
    const names: string[] = [];
    for (let offset = 0; ; offset += BATCH_SIZE) {
      const { data, error } = await this.bucket().list(folder, { limit: BATCH_SIZE, offset });
      if (error) {
        throw new StorageOperationError('list source files', error);
      }
      names.push(...data.map((object) => object.name));
      if (data.length < BATCH_SIZE) {
        return names;
      }
    }
  }

  private async removePaths(paths: readonly string[]): Promise<void> {
    for (let start = 0; start < paths.length; start += BATCH_SIZE) {
      const { error } = await this.bucket().remove(paths.slice(start, start + BATCH_SIZE));
      if (error) {
        throw new StorageOperationError('remove source files', error);
      }
    }
  }

  private bucket() {
    return this.client.from(SOURCES_BUCKET);
  }
}
