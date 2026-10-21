import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseUserAdmin } from './supabase-user-admin';

const EMAIL = 'demo@example.test';

function user(id: string, email?: string) {
  return { id, email };
}

/** Only the Admin API calls the seed uses, typed loosely on purpose. */
function fakeClient(admin: Record<string, ReturnType<typeof vi.fn>>): SupabaseClient {
  return { auth: { admin } } as unknown as SupabaseClient;
}

function pages(...userPages: { id: string; email?: string }[][]) {
  return vi.fn(({ page }: { page: number }) =>
    Promise.resolve({ data: { users: userPages[page - 1] ?? [] }, error: null }),
  );
}

const fullPage = (prefix: string) =>
  Array.from({ length: 200 }, (_, index) => user(`${prefix}-${index}`, `${prefix}${index}@x.test`));

describe('SupabaseUserAdmin.findUserIdByEmail', () => {
  it('finds an existing user case-insensitively on a later page', async () => {
    const listUsers = pages(fullPage('a'), [user('no-email'), user('demo-id', EMAIL)]);
    const admin = new SupabaseUserAdmin(fakeClient({ listUsers }));

    await expect(admin.findUserIdByEmail('Demo@Example.TEST')).resolves.toBe('demo-id');
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('returns null after the last page', async () => {
    const listUsers = pages(fullPage('a'), fullPage('b'), []);
    const admin = new SupabaseUserAdmin(fakeClient({ listUsers }));

    await expect(admin.findUserIdByEmail(EMAIL)).resolves.toBeNull();
    expect(listUsers).toHaveBeenCalledTimes(3);
  });

  it('fails without echoing the provider message', async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: { users: [] },
      error: { name: 'AuthApiError', status: 401, code: 'bad_jwt', message: `secret ${EMAIL}` },
    });
    const admin = new SupabaseUserAdmin(fakeClient({ listUsers }));

    const failure = admin.findUserIdByEmail(EMAIL);
    await expect(failure).rejects.toThrow('list users (AuthApiError, 401, bad_jwt)');
    await expect(failure).rejects.not.toThrow(EMAIL);
  });
});

describe('SupabaseUserAdmin writes', () => {
  it('creates a confirmed user', async () => {
    const createUser = vi.fn().mockResolvedValue({ data: { user: user('new-id') }, error: null });
    const admin = new SupabaseUserAdmin(fakeClient({ createUser }));

    await expect(admin.createUser(EMAIL, 'pw-123456')).resolves.toBe('new-id');
    expect(createUser).toHaveBeenCalledWith({
      email: EMAIL,
      password: 'pw-123456',
      email_confirm: true,
    });
  });

  it('resets the password of an existing user', async () => {
    const updateUserById = vi.fn().mockResolvedValue({ data: { user: user('id') }, error: null });
    const admin = new SupabaseUserAdmin(fakeClient({ updateUserById }));

    await admin.resetPassword('id', 'pw-123456');

    expect(updateUserById).toHaveBeenCalledWith('id', {
      password: 'pw-123456',
      email_confirm: true,
    });
  });

  it('fails when the password reset is rejected', async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthWeakPasswordError', status: 422, code: 'weak_password', message: 'x' },
    });
    const admin = new SupabaseUserAdmin(fakeClient({ updateUserById }));

    await expect(admin.resetPassword('id', 'pw')).rejects.toThrow(
      'reset the demo password (AuthWeakPasswordError, 422, weak_password)',
    );
  });
});
