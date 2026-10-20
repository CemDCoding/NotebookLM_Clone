import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from './env';
import { resolveAuthRedirect } from './route-access';

interface PendingCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Refreshes the Supabase session of the request and applies the route rules.
 * This is an optimistic check for navigation only. The API verifies the token on every request.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders: Record<string, string> = {};
  const { url, anonKey } = getSupabaseEnv();

  // A new client per request, as required by @supabase/ssr: the cache headers come with the
  // first cookie write only.
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        // Forward refreshed tokens to the rendering of this request as well.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        pendingCookies.push(...cookiesToSet);
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  // getClaims validates the token and refreshes an expired session before any page renders.
  // An error (invalid token, Supabase unreachable) counts as "not signed in", which fails closed.
  const { data } = await supabase.auth.getClaims();
  const target = resolveAuthRedirect(request.nextUrl.pathname, Boolean(data?.claims));

  const response = target
    ? NextResponse.redirect(new URL(target, request.url))
    : NextResponse.next({ request });

  // Responses that set auth cookies must reach the browser, also on redirects, and must not be
  // cached by a CDN, otherwise one user's session could be served to another.
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  for (const [key, value] of Object.entries(pendingHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}
