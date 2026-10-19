import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS, ErrorCode, ErrorResponseSchema, HealthResponseSchema } from './index';

describe('DEFAULT_LIMITS', () => {
  it('matches the values documented in CLAUDE.md section 7', () => {
    expect(DEFAULT_LIMITS).toEqual({
      maxFileSizeBytes: 10 * 1024 * 1024,
      maxPdfPages: 300,
      maxPastedTextChars: 500_000,
      maxSourcesPerNotebook: 20,
      maxNotebooksPerUser: 25,
      chatRequestsPerUserPerHour: 100,
      chatRequestsGlobalPerDay: 500,
      uploadsGlobalPerDay: 200,
    });
  });
});

describe('ErrorResponseSchema', () => {
  it('accepts an error without a code', () => {
    const body = { statusCode: 404, error: 'NotFound', message: 'Notebook not found' };
    expect(ErrorResponseSchema.parse(body)).toEqual(body);
  });

  it('accepts every known error code', () => {
    for (const code of Object.values(ErrorCode)) {
      const body = { statusCode: 429, error: 'TooManyRequests', message: 'Limit reached', code };
      expect(ErrorResponseSchema.safeParse(body).success).toBe(true);
    }
  });

  it('rejects an unknown code', () => {
    const body = { statusCode: 400, error: 'BadRequest', message: 'x', code: 'SOMETHING_ELSE' };
    expect(ErrorResponseSchema.safeParse(body).success).toBe(false);
  });

  it('rejects a non-error status code and missing fields', () => {
    expect(
      ErrorResponseSchema.safeParse({ statusCode: 200, error: 'Ok', message: 'x' }).success,
    ).toBe(false);
    expect(ErrorResponseSchema.safeParse({ statusCode: 500 }).success).toBe(false);
  });
});

describe('HealthResponseSchema', () => {
  it('accepts a healthy and a degraded response', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok', database: 'up' }).success).toBe(true);
    expect(HealthResponseSchema.safeParse({ status: 'error', database: 'down' }).success).toBe(
      true,
    );
  });

  it('rejects unknown database states', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok', database: 'maybe' }).success).toBe(false);
  });
});
