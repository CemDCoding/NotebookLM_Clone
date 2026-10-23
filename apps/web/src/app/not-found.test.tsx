import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NotFound from './not-found';

describe('NotFound', () => {
  it('explains the unknown address and leads back to the start page', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Zur Startseite' })).toHaveAttribute('href', '/');
  });

  it('shows the legal links like every public page', () => {
    render(<NotFound />);

    expect(screen.getByRole('navigation', { name: 'Rechtliches' })).toBeInTheDocument();
  });
});
