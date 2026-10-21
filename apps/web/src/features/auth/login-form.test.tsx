import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

const signInWithPassword = vi.fn();
const router = { replace: vi.fn(), refresh: vi.fn() };

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-Mail-Adresse'), email);
  await user.type(screen.getByLabelText('Passwort'), password);
  await user.click(screen.getByRole('button', { name: 'Anmelden' }));
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs in with the entered credentials and opens the notebooks', async () => {
    signInWithPassword.mockResolvedValueOnce({ data: {}, error: null });
    render(<LoginForm />);

    await submit(' nutzer@example.com ', 'geheim');

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'nutzer@example.com',
      password: 'geheim',
    });
    expect(router.replace).toHaveBeenCalledWith('/notebooks');
  });

  it('explains wrong credentials and stays on the page', async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { code: 'invalid_credentials' },
    });
    render(<LoginForm />);

    await submit('nutzer@example.com', 'falsch');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-Mail-Adresse oder Passwort ist falsch',
    );
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
