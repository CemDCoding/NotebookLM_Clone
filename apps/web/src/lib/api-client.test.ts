import { ErrorCode } from '@notebooklm/shared';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, createApiFetch, type ApiClientDeps, type SessionTokens } from './api-client';

// The real module would create a Supabase client; these tests inject their own session instead.
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));

const NotebookSchema = z.object({ id: z.string(), title: z.string() });

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthorized(): Response {
  return jsonResponse(401, { statusCode: 401, error: 'Unauthorized', message: 'Unauthorized' });
}

function setup(responses: Response[], session: Partial<SessionTokens> = {}) {
  const fetch = vi.fn<ApiClientDeps['fetch']>();
  for (const response of responses) {
    fetch.mockResolvedValueOnce(response);
  }
  const fakeSession: SessionTokens = {
    getAccessToken: vi.fn(async () => 'token-1'),
    refreshAccessToken: vi.fn(async () => 'token-2'),
    clearSession: vi.fn(async () => undefined),
    ...session,
  };
  const redirectToLogin = vi.fn();
  const apiFetch = createApiFetch({
    baseUrl: 'http://api.test/',
    session: fakeSession,
    fetch,
    redirectToLogin,
  });
  return { apiFetch, fetch, session: fakeSession, redirectToLogin };
}

function authorizationOf(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get('Authorization');
}

describe('apiFetch', () => {
  it('sends the access token and returns the parsed response', async () => {
    const { apiFetch, fetch } = setup([jsonResponse(200, { id: 'n1', title: 'Notizen' })]);

    const notebook = await apiFetch('/notebooks/n1', { schema: NotebookSchema });

    expect(notebook).toEqual({ id: 'n1', title: 'Notizen' });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/notebooks/n1');
    expect(init?.method).toBe('GET');
    expect(authorizationOf(init)).toBe('Bearer token-1');
  });

  it('sends a body as JSON', async () => {
    const { apiFetch, fetch } = setup([jsonResponse(201, { id: 'n1', title: 'Neu' })]);

    await apiFetch('/notebooks', {
      method: 'POST',
      body: { title: 'Neu' },
      schema: NotebookSchema,
    });

    const init = fetch.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(init?.body).toBe(JSON.stringify({ title: 'Neu' }));
  });

  it('resolves without a value when no schema is given', async () => {
    const { apiFetch } = setup([new Response(null, { status: 204 })]);

    await expect(apiFetch('/notebooks/n1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('rejects a response that does not match the schema', async () => {
    const { apiFetch } = setup([jsonResponse(200, { id: 'n1' })]);

    const error = await apiFetch('/notebooks/n1', { schema: NotebookSchema }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 200, message: expect.stringMatching(/unerwartete/) });
  });

  it('turns an error response into an ApiError with status, code and message', async () => {
    const { apiFetch } = setup([
      jsonResponse(429, {
        statusCode: 429,
        error: 'LimitExceededError',
        message: 'Du kannst höchstens 25 Notebooks anlegen.',
        code: ErrorCode.LIMIT_EXCEEDED,
      }),
    ]);

    const error = await apiFetch('/notebooks', { method: 'POST', body: { title: 'x' } }).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      code: ErrorCode.LIMIT_EXCEEDED,
      message: 'Du kannst höchstens 25 Notebooks anlegen.',
    });
  });

  it('uses a generic message when the error body is not in the error format', async () => {
    const { apiFetch } = setup([new Response('<html>Bad Gateway</html>', { status: 502 })]);

    const error = await apiFetch('/notebooks').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: undefined });
    expect(error.message).toMatch(/fehlgeschlagen/);
  });

  it('reports an unreachable server as ApiError with status 0', async () => {
    const { apiFetch, fetch } = setup([]);
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const error = await apiFetch('/notebooks').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
  });

  it('passes an abort through unchanged', async () => {
    const { apiFetch, fetch } = setup([]);
    const controller = new AbortController();
    const abortError = new DOMException('Aborted', 'AbortError');
    fetch.mockImplementationOnce(async () => {
      controller.abort();
      throw abortError;
    });

    await expect(apiFetch('/notebooks', { signal: controller.signal })).rejects.toBe(abortError);
  });

  describe('on 401', () => {
    it('renews the session once and retries with the new token', async () => {
      const { apiFetch, fetch, session, redirectToLogin } = setup([
        unauthorized(),
        jsonResponse(200, { id: 'n1', title: 'Notizen' }),
      ]);

      const notebook = await apiFetch('/notebooks/n1', { schema: NotebookSchema });

      expect(notebook.title).toBe('Notizen');
      expect(session.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(authorizationOf(fetch.mock.calls[1]?.[1])).toBe('Bearer token-2');
      expect(redirectToLogin).not.toHaveBeenCalled();
    });

    it('ends the session and redirects to the login if the retry is rejected too', async () => {
      const { apiFetch, fetch, session, redirectToLogin } = setup([unauthorized(), unauthorized()]);

      const error = await apiFetch('/notebooks').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(401);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(session.clearSession).toHaveBeenCalledTimes(1);
      expect(redirectToLogin).toHaveBeenCalledTimes(1);
    });

    it('redirects to the login without a retry if the session cannot be renewed', async () => {
      const { apiFetch, fetch, session, redirectToLogin } = setup([unauthorized()], {
        refreshAccessToken: vi.fn(async () => null),
      });

      await expect(apiFetch('/notebooks')).rejects.toMatchObject({ status: 401 });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(session.clearSession).toHaveBeenCalledTimes(1);
      expect(redirectToLogin).toHaveBeenCalledTimes(1);
    });
  });

  it('redirects to the login without calling the API when there is no session', async () => {
    const { apiFetch, fetch, redirectToLogin } = setup([], {
      getAccessToken: vi.fn(async () => null),
    });

    await expect(apiFetch('/notebooks')).rejects.toMatchObject({ status: 401 });

    expect(fetch).not.toHaveBeenCalled();
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });
});
