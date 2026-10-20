import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from './page';

describe('HomePage', () => {
  it('shows the title, the access notice and a link to the login', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('NotebookLM-Klon');
    expect(screen.getByText(/Zugänge werden vergeben/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login');
  });
});
