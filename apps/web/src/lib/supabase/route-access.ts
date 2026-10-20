export const LOGIN_PATH = '/login';
export const NOTEBOOKS_PATH = '/notebooks';

// Pages of the (app) route group. Route groups do not appear in the URL, so they are listed here.
// The matcher in src/proxy.ts must cover the same paths.
const PROTECTED_PREFIXES = [NOTEBOOKS_PATH, '/settings'];

// Pages that make no sense with a session: the start page and the login itself.
const GUEST_ONLY_PATHS = ['/', LOGIN_PATH];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Returns the path to redirect to, or `null` if the request may pass. */
export function resolveAuthRedirect(pathname: string, isAuthenticated: boolean): string | null {
  if (!isAuthenticated && isProtectedPath(pathname)) {
    return LOGIN_PATH;
  }

  if (isAuthenticated && GUEST_ONLY_PATHS.includes(pathname)) {
    return NOTEBOOKS_PATH;
  }

  return null;
}
