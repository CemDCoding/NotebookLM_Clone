import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from './page';

describe('HomePage', () => {
  it('shows the title, the access notice and a link to the login', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Quellenchat');
    expect(screen.getByText(/Zugänge werden vergeben/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login');
  });

  it('links the legal notice and the privacy policy', () => {
    render(<HomePage />);

    const legal = screen.getByRole('navigation', { name: 'Rechtliches' });
    expect(legal).toContainElement(screen.getByRole('link', { name: 'Impressum' }));
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum');
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute(
      'href',
      '/datenschutz',
    );
  });
});
