import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

describe('LoginPage', () => {
  it('shows the login form with the access notice', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Quellenchat');
    expect(screen.getByLabelText('E-Mail-Adresse')).toBeInTheDocument();
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument();
    expect(screen.getByText(/Zugänge werden vom Betreiber vergeben/)).toBeInTheDocument();
  });

  it('offers no registration and no password reset', () => {
    render(<LoginPage />);

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Anmelden']);
    expect(screen.queryByRole('link', { name: /registrier|konto|passwort/i })).toBeNull();
  });

  it('links the legal notice and the privacy policy', () => {
    render(<LoginPage />);

    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum');
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute(
      'href',
      '/datenschutz',
    );
  });
});
