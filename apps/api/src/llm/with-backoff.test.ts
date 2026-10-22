import { APIConnectionError, APIError } from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { abortableSleep, isRetryableError, withBackoff } from './with-backoff';

const apiError = (status: number): APIError =>
  APIError.generate(status, undefined, `status ${status}`, new Headers());

/** Records the requested delays instead of waiting. */
function recordingSleep() {
  const delays: number[] = [];
  const sleep = vi.fn((ms: number) => {
    delays.push(ms);
    return Promise.resolve();
  });
  return { delays, sleep };
}

describe('isRetryableError', () => {
  it.each([429, 500, 502, 503])('retries status %i', (status) => {
    expect(isRetryableError(apiError(status))).toBe(true);
  });

  it.each([400, 401, 403, 404, 422])('does not retry status %i', (status) => {
    expect(isRetryableError(apiError(status))).toBe(false);
  });

  it('does not retry errors without a status or from elsewhere', () => {
    expect(isRetryableError(new APIConnectionError({ message: 'offline' }))).toBe(false);
    expect(isRetryableError(new Error('boom'))).toBe(false);
  });
});

describe('withBackoff', () => {
  it('returns the first successful result without waiting', async () => {
    const { sleep } = recordingSleep();

    await expect(withBackoff(() => Promise.resolve('ok'), { sleep })).resolves.toBe('ok');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries 429 with exponentially growing delays', async () => {
    const { delays, sleep } = recordingSleep();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValue('ok');

    await expect(withBackoff(operation, { sleep, baseDelayMs: 100 })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(4);
    expect(delays).toEqual([100, 200, 400]);
  });

  it('caps the delay', async () => {
    const { delays, sleep } = recordingSleep();
    const operation = vi.fn(() => Promise.reject(apiError(429)));

    await expect(
      withBackoff(operation, { sleep, baseDelayMs: 100, maxDelayMs: 250 }),
    ).rejects.toThrow(APIError);
    expect(delays).toEqual([100, 200, 250, 250]);
  });

  it('gives up after 5 attempts and rethrows the last error', async () => {
    const { sleep } = recordingSleep();
    const last = apiError(500);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(last);

    await expect(withBackoff(operation, { sleep })).rejects.toBe(last);
    expect(operation).toHaveBeenCalledTimes(5);
    expect(sleep).toHaveBeenCalledTimes(4);
  });

  it('does not retry permanent errors', async () => {
    const { sleep } = recordingSleep();
    const error = apiError(401);
    const operation = vi.fn(() => Promise.reject(error));

    await expect(withBackoff(operation, { sleep })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('passes the signal to the operation', async () => {
    const controller = new AbortController();
    const operation = vi.fn(() => Promise.resolve('ok'));

    await withBackoff(operation, { signal: controller.signal });
    expect(operation).toHaveBeenCalledWith(controller.signal);
  });

  it('does not start when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    const operation = vi.fn(() => Promise.resolve('ok'));

    await expect(withBackoff(operation, { signal: controller.signal })).rejects.toThrow(
      'cancelled',
    );
    expect(operation).not.toHaveBeenCalled();
  });

  it('stops retrying once the signal is aborted during an attempt', async () => {
    const controller = new AbortController();
    const { sleep } = recordingSleep();
    const operation = vi.fn(() => {
      controller.abort();
      return Promise.reject(apiError(429));
    });

    await expect(withBackoff(operation, { signal: controller.signal, sleep })).rejects.toThrow(
      APIError,
    );
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('stops waiting and makes no further attempt when aborted during the delay', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const operation = vi.fn(() => Promise.reject(apiError(429)));

      const result = withBackoff(operation, { signal: controller.signal, baseDelayMs: 10_000 });
      const assertion = expect(result).rejects.toThrow('cancelled');
      await vi.advanceTimersByTimeAsync(1_000);
      controller.abort(new Error('cancelled'));
      await assertion;

      await vi.advanceTimersByTimeAsync(60_000);
      expect(operation).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('abortableSleep', () => {
  it('resolves after the delay', async () => {
    vi.useFakeTimers();
    try {
      const done = vi.fn();
      void abortableSleep(500).then(done);

      await vi.advanceTimersByTimeAsync(499);
      expect(done).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(done).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects at once for an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));

    await expect(abortableSleep(10_000, controller.signal)).rejects.toThrow('cancelled');
  });
});
