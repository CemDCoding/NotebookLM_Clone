import { describe, expect, it } from 'vitest';
import { resolveAuthRedirect } from './route-access';

describe('resolveAuthRedirect', () => {
  it.each(['/notebooks', '/notebooks/3f6c', '/settings'])(
    'sends a guest from %s to the login',
    (pathname) => {
      expect(resolveAuthRedirect(pathname, false)).toBe('/login');
    },
  );

  it.each(['/', '/login'])('sends a signed-in user from %s to the notebooks', (pathname) => {
    expect(resolveAuthRedirect(pathname, true)).toBe('/notebooks');
  });

  it.each([
    ['/', false],
    ['/login', false],
    ['/notebooks/3f6c', true],
    ['/impressum', false],
    ['/impressum', true],
  ])('lets %s pass (signed in: %s)', (pathname, isAuthenticated) => {
    expect(resolveAuthRedirect(pathname, isAuthenticated)).toBeNull();
  });

  it('does not treat paths that only start with a protected name as protected', () => {
    expect(resolveAuthRedirect('/notebooks-info', false)).toBeNull();
  });
});
