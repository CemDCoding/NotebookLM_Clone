/** Title of the notebook every seed run recreates for the demo account. */
export const DEMO_NOTEBOOK_TITLE = 'Demo: Einführung';

/** Account management through the Supabase Admin API (registration is disabled). */
export interface DemoUserAdmin {
  /** Returns the ID of the user with this email, or `null` if there is none. */
  findUserIdByEmail(email: string): Promise<string | null>;
  /** Creates a confirmed user and returns its ID. */
  createUser(email: string, password: string): Promise<string>;
  /** Sets the password and confirms the email, so a changed password is reset. */
  resetPassword(userId: string, password: string): Promise<void>;
}

export interface DemoNotebookRepository {
  /**
   * Deletes all notebooks of the user and creates one with the given title, in
   * one transaction, so a failed run never leaves the account half reset.
   * Returns the IDs of the deleted notebooks and the new one.
   */
  replaceAll(userId: string, title: string): Promise<{ deletedIds: string[]; createdId: string }>;
}

export interface DemoSeedLogger {
  log(message: string): void;
}

export interface DemoSeedDeps {
  users: DemoUserAdmin;
  notebooks: DemoNotebookRepository;
  logger: DemoSeedLogger;
}

export interface DemoCredentials {
  email: string;
  password: string;
}

export interface DemoSeedResult {
  userId: string;
  userCreated: boolean;
  notebookId: string;
  deletedNotebookCount: number;
}

/**
 * Resets the demo account to its initial state (CLAUDE.md section 7 "Demo-Account"):
 * finds or creates the user, resets the password and replaces all notebooks with
 * the empty demo notebook. Running it twice yields the same state. Only IDs and
 * counts are logged, never the email or the password.
 */
export async function seedDemoAccount(
  credentials: DemoCredentials,
  { users, notebooks, logger }: DemoSeedDeps,
): Promise<DemoSeedResult> {
  const existingId = await users.findUserIdByEmail(credentials.email);

  let userId: string;
  if (existingId === null) {
    userId = await users.createUser(credentials.email, credentials.password);
    logger.log(`Created demo user ${userId}`);
  } else {
    userId = existingId;
    // A new user already has the password; an existing one may have changed it.
    await users.resetPassword(userId, credentials.password);
    logger.log(`Reused demo user ${userId}, password reset`);
  }

  // Storage files are deleted here from M3 on, once notebooks can hold sources (PE-17).
  const { deletedIds, createdId } = await notebooks.replaceAll(userId, DEMO_NOTEBOOK_TITLE);
  logger.log(`Deleted ${deletedIds.length} notebook(s), created demo notebook ${createdId}`);

  return {
    userId,
    userCreated: existingId === null,
    notebookId: createdId,
    deletedNotebookCount: deletedIds.length,
  };
}
