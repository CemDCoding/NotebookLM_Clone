import type { SupabaseClient } from '@supabase/supabase-js';
import type { DemoUserAdmin } from './demo-seed';

// The Admin API has no lookup by email, so the seed pages through all users.
// Accounts are created only by the operator, so there are few pages.
const PAGE_SIZE = 200;

/** Fails with the error's class and code only; Supabase messages may echo the email. */
function adminError(action: string, error: { name: string; status?: number; code?: string }) {
  const details = [error.name, error.status, error.code].filter((part) => part !== undefined);
  return new Error(`Supabase Admin API failed to ${action} (${details.join(', ')})`);
}

export class SupabaseUserAdmin implements DemoUserAdmin {
  constructor(private readonly client: SupabaseClient) {}

  async findUserIdByEmail(email: string): Promise<string | null> {
    const wanted = email.toLowerCase();
    for (let page = 1; ; page++) {
      const { data, error } = await this.client.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      if (error) {
        throw adminError('list users', error);
      }
      // Supabase stores emails in lower case.
      const match = data.users.find((user) => user.email?.toLowerCase() === wanted);
      if (match) {
        return match.id;
      }
      if (data.users.length < PAGE_SIZE) {
        return null;
      }
    }
  }

  async createUser(email: string, password: string): Promise<string> {
    const { data, error } = await this.client.auth.admin.createUser({
      email,
      password,
      // No confirmation mail exists (CLAUDE.md section 2), so the account is confirmed directly.
      email_confirm: true,
    });
    if (error) {
      throw adminError('create the demo user', error);
    }
    return data.user.id;
  }

  async resetPassword(userId: string, password: string): Promise<void> {
    const { error } = await this.client.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) {
      throw adminError('reset the demo password', error);
    }
  }
}
