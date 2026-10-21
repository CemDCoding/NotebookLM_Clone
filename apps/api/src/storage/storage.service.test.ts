import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SOURCES_BUCKET,
  sourceObjectPath,
  type StorageClient,
  StorageOperationError,
  StorageService,
} from './storage.service';

const USER_ID = '6f1c1f4e-2a3b-4c5d-8e9f-0a1b2c3d4e5f';
const SOURCE_ID = '0d9e8f7a-6b5c-4d3e-9f1a-2b3c4d5e6f70';
const OTHER_SOURCE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

interface FakeError {
  name: string;
  status: number;
  statusCode: string;
  message: string;
}
type Result<T> = Promise<{ data: T; error: null } | { data: null; error: FakeError }>;

const ok = <T>(data: T): Result<T> => Promise.resolve({ data, error: null });
const failed = (): Result<never> =>
  Promise.resolve({
    data: null,
    error: {
      name: 'StorageApiError',
      status: 400,
      statusCode: '409',
      message: `The resource already exists: ${USER_ID}/${SOURCE_ID}`,
    },
  });

/** The bucket methods the service uses, typed loosely on purpose. */
function fakeStorage() {
  const bucket = {
    upload: vi.fn<(...args: unknown[]) => Result<{ path: string }>>(() => ok({ path: '' })),
    download: vi.fn<(path: string) => Result<Blob>>(() => ok(new Blob([]))),
    remove: vi.fn<(paths: string[]) => Result<unknown[]>>(() => ok([])),
    list: vi.fn<(...args: unknown[]) => Result<{ name: string }[]>>(() => ok([])),
  };
  const from = vi.fn(() => bucket);
  const service = new StorageService({ from } as unknown as StorageClient);
  return { bucket, from, service };
}

describe('sourceObjectPath', () => {
  it('builds {userId}/{sourceId}', () => {
    expect(sourceObjectPath(USER_ID, SOURCE_ID)).toBe(`${USER_ID}/${SOURCE_ID}`);
  });

  it.each(['', '..', `${USER_ID}/..`, '../other', 'a/b', `${USER_ID}\\x`])(
    'refuses the segment %j',
    (segment) => {
      expect(() => sourceObjectPath(segment, SOURCE_ID)).toThrow('must be UUIDs');
      expect(() => sourceObjectPath(USER_ID, segment)).toThrow('must be UUIDs');
    },
  );
});

describe('StorageService', () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    storage = fakeStorage();
  });

  it('uploads to {userId}/{sourceId} in the sources bucket without overwriting', async () => {
    const content = Buffer.from('Hallo Welt');

    await storage.service.upload(USER_ID, SOURCE_ID, content, 'text/plain; charset=utf-8');

    expect(storage.from).toHaveBeenCalledWith(SOURCES_BUCKET);
    expect(storage.bucket.upload).toHaveBeenCalledWith(`${USER_ID}/${SOURCE_ID}`, content, {
      contentType: 'text/plain; charset=utf-8',
      upsert: false,
    });
  });

  it('never uploads when an ID is not a UUID', async () => {
    await expect(
      storage.service.upload('../' + USER_ID, SOURCE_ID, Buffer.from('x'), 'text/plain'),
    ).rejects.toThrow('must be UUIDs');
    expect(storage.bucket.upload).not.toHaveBeenCalled();
  });

  it('fails without echoing the provider message', async () => {
    storage.bucket.upload.mockImplementation(failed);

    const upload = storage.service.upload(USER_ID, SOURCE_ID, Buffer.from('x'), 'text/plain');

    await expect(upload).rejects.toThrow(StorageOperationError);
    await expect(upload).rejects.toThrow('upload a source file (StorageApiError, 400, 409)');
    await expect(upload).rejects.not.toThrow(USER_ID);
  });

  it('downloads a file as a Buffer', async () => {
    storage.bucket.download.mockImplementation(() => ok(new Blob(['Größe'])));

    const content = await storage.service.download(USER_ID, SOURCE_ID);

    expect(storage.bucket.download).toHaveBeenCalledWith(`${USER_ID}/${SOURCE_ID}`);
    expect(content.toString('utf8')).toBe('Größe');
  });

  it('fails when the download fails', async () => {
    storage.bucket.download.mockImplementation(failed);

    await expect(storage.service.download(USER_ID, SOURCE_ID)).rejects.toThrow(
      'download a source file',
    );
  });

  it('removes the files of the given sources', async () => {
    await storage.service.remove(USER_ID, [SOURCE_ID, OTHER_SOURCE_ID]);

    expect(storage.bucket.remove).toHaveBeenCalledWith([
      `${USER_ID}/${SOURCE_ID}`,
      `${USER_ID}/${OTHER_SOURCE_ID}`,
    ]);
  });

  it('does not call Storage when there is nothing to remove', async () => {
    await storage.service.remove(USER_ID, []);

    expect(storage.bucket.remove).not.toHaveBeenCalled();
  });

  it('fails when removing fails, so the caller keeps the database rows (PE-22)', async () => {
    storage.bucket.remove.mockImplementation(failed);

    await expect(storage.service.remove(USER_ID, [SOURCE_ID])).rejects.toThrow(
      'remove source files',
    );
  });

  it('removes every file in the user folder across list pages', async () => {
    const page = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) => ({ name: `${prefix}-${index}` }));
    storage.bucket.list
      .mockImplementationOnce(() => ok(page('a', 1000)))
      .mockImplementationOnce(() => ok(page('b', 2)));

    await storage.service.removeAllForUser(USER_ID);

    expect(storage.bucket.list).toHaveBeenNthCalledWith(1, USER_ID, { limit: 1000, offset: 0 });
    expect(storage.bucket.list).toHaveBeenNthCalledWith(2, USER_ID, { limit: 1000, offset: 1000 });
    expect(storage.bucket.remove).toHaveBeenCalledTimes(2);
    const removed = storage.bucket.remove.mock.calls.flatMap(([paths]) => paths);
    expect(removed).toHaveLength(1002);
    expect(removed[0]).toBe(`${USER_ID}/a-0`);
    expect(removed.at(-1)).toBe(`${USER_ID}/b-1`);
  });

  it('refuses to clear a folder that is not a user ID', async () => {
    await expect(storage.service.removeAllForUser('')).rejects.toThrow('must be UUIDs');
    expect(storage.bucket.list).not.toHaveBeenCalled();
  });

  it('fails when listing the user folder fails', async () => {
    storage.bucket.list.mockImplementation(failed);

    await expect(storage.service.removeAllForUser(USER_ID)).rejects.toThrow('list source files');
    expect(storage.bucket.remove).not.toHaveBeenCalled();
  });
});
