import { ErrorResponseSchema, type ErrorCode } from '@notebooklm/shared';
import type { ZodType } from 'zod';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LOGIN_PATH } from '@/lib/supabase/route-access';

const FALLBACK_ERROR_MESSAGE = 'Die Anfrage ist fehlgeschlagen. Bitte versuche es erneut.';
const NETWORK_ERROR_MESSAGE =
  'Der Server ist gerade nicht erreichbar. Bitte prüfe deine Verbindung und versuche es erneut.';
const INVALID_RESPONSE_MESSAGE =
  'Der Server hat eine unerwartete Antwort geschickt. Bitte versuche es erneut.';
const SESSION_EXPIRED_MESSAGE = 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.';

/** Every failure of `apiFetch` except an abort. `message` is German text, ready for display. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  /** HTTP status of the response, `0` if the server could not be reached. */
  readonly status: number;
  readonly code: ErrorCode | undefined;

  constructor(status: number, message: string, code?: ErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
    this.code = code;
  }
}

/** Access to the Supabase session, separated so tests run without Supabase. */
export interface SessionTokens {
  getAccessToken(): Promise<string | null>;
  /** Returns the new access token, or `null` if the session cannot be renewed. */
  refreshAccessToken(): Promise<string | null>;
  clearSession(): Promise<void>;
}

export interface ApiClientDeps {
  baseUrl: string | undefined;
  session: SessionTokens;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  redirectToLogin: () => void;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: HttpMethod;
  /** Sent as JSON, a `FormData` body is sent as multipart. */
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiFetchOptions<T> extends ApiRequestOptions {
  /** Parses the response, so the returned type also holds at runtime. */
  schema: ZodType<T>;
}

export interface ApiFetch {
  <T>(path: string, options: ApiFetchOptions<T>): Promise<T>;
  /** Without a schema the response body is ignored, e.g. for `204 No Content`. */
  (path: string, options?: ApiRequestOptions): Promise<void>;
}

export function createApiFetch(deps: ApiClientDeps): ApiFetch {
  async function send(url: string, options: ApiRequestOptions, token: string): Promise<Response> {
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
      // The browser sets the multipart boundary itself.
      body = options.body;
    } else if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }

    try {
      return await deps.fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body,
        signal: options.signal,
      });
    } catch (error) {
      // An abort is the caller's decision, not a failure to report.
      if (options.signal?.aborted) {
        throw error;
      }
      throw new ApiError(0, NETWORK_ERROR_MESSAGE, undefined, { cause: error });
    }
  }

  async function endSession(): Promise<never> {
    // Clearing the session first prevents a redirect loop: proxy.ts would otherwise send a
    // session the API rejects straight back from /login.
    await deps.session.clearSession();
    deps.redirectToLogin();
    throw new ApiError(401, SESSION_EXPIRED_MESSAGE);
  }

  function apiFetch<T>(path: string, options: ApiFetchOptions<T>): Promise<T>;
  function apiFetch(path: string, options?: ApiRequestOptions): Promise<void>;
  async function apiFetch<T>(
    path: string,
    options: ApiRequestOptions & { schema?: ZodType<T> } = {},
  ): Promise<T | void> {
    if (!deps.baseUrl) {
      throw new Error('NEXT_PUBLIC_API_URL must be set');
    }
    const url = `${deps.baseUrl.replace(/\/+$/, '')}${path}`;

    const token = await deps.session.getAccessToken();
    if (!token) {
      return endSession();
    }

    let response = await send(url, options, token);
    if (response.status === 401) {
      // The token may have expired between reading and sending it: renew once, then give up.
      const renewedToken = await deps.session.refreshAccessToken();
      if (!renewedToken) {
        return endSession();
      }
      response = await send(url, options, renewedToken);
      if (response.status === 401) {
        return endSession();
      }
    }

    if (!response.ok) {
      throw await toApiError(response);
    }
    if (!options.schema) {
      return;
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      throw new ApiError(response.status, INVALID_RESPONSE_MESSAGE, undefined, { cause: error });
    }
    const parsed = options.schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(response.status, INVALID_RESPONSE_MESSAGE, undefined, {
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  return apiFetch;
}

async function toApiError(response: Response): Promise<ApiError> {
  // Errors from a proxy or gateway in front of the API may not be JSON at all;
  // they get the generic message instead.
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = ErrorResponseSchema.safeParse(body);
  if (!parsed.success) {
    return new ApiError(response.status, FALLBACK_ERROR_MESSAGE);
  }
  return new ApiError(response.status, parsed.data.message, parsed.data.code);
}

const supabaseSession: SessionTokens = {
  async getAccessToken() {
    // In the browser getSession reads the client's own cookies and renews an expired token.
    const { data } = await createSupabaseBrowserClient().auth.getSession();
    return data.session?.access_token ?? null;
  },
  async refreshAccessToken() {
    // A failed renewal means the session is gone; the caller then sends the user to the login.
    const { data } = await createSupabaseBrowserClient().auth.refreshSession();
    return data.session?.access_token ?? null;
  },
  async clearSession() {
    // Local scope: the demo account is shared, a global sign-out would end every reviewer's session.
    // The local session is removed even if revoking it on the server fails.
    await createSupabaseBrowserClient().auth.signOut({ scope: 'local' });
  },
};

/** Calls the NestJS API from the browser with the access token of the current session. */
export const apiFetch = createApiFetch({
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
  session: supabaseSession,
  // Wrapped so `fetch` is not called with `deps` as `this`, which browsers reject.
  fetch: (url, init) => fetch(url, init),
  // A full page load also drops all cached data of the previous session.
  redirectToLogin: () => window.location.assign(LOGIN_PATH),
});
