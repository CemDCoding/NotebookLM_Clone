import { z } from 'zod';

const requiredText = z.string().trim().min(1);

const LegalContactEnvSchema = z.object({
  IMPRESSUM_NAME: requiredText,
  IMPRESSUM_STREET: requiredText,
  IMPRESSUM_CITY: requiredText,
  IMPRESSUM_EMAIL: z.email(),
});

export interface LegalContact {
  name: string;
  street: string;
  city: string;
  email: string;
}

/**
 * Reads the operator's details for the legal notice and the privacy policy from
 * server-only environment variables, so the personal address never ends up in the
 * public repository. Locally and in previews the pages render without them, but a
 * Vercel production build fails: a public site must not go live without a legal notice.
 */
export function getLegalContact(
  env: Record<string, string | undefined> = process.env,
): LegalContact | null {
  const result = LegalContactEnvSchema.safeParse(env);
  if (result.success) {
    const { IMPRESSUM_NAME, IMPRESSUM_STREET, IMPRESSUM_CITY, IMPRESSUM_EMAIL } = result.data;
    return {
      name: IMPRESSUM_NAME,
      street: IMPRESSUM_STREET,
      city: IMPRESSUM_CITY,
      email: IMPRESSUM_EMAIL,
    };
  }

  if (env.VERCEL_ENV === 'production') {
    // Names only, never values: the build log is visible to everyone with project access.
    const variables = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Legal notice is incomplete, missing or invalid: ${variables}`);
  }
  return null;
}
