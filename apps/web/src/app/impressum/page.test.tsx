import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImpressumPage from './page';

describe('ImpressumPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows the operator details from the environment', () => {
    vi.stubEnv('IMPRESSUM_NAME', 'Erika Mustermann');
    vi.stubEnv('IMPRESSUM_STREET', 'Musterstraße 1');
    vi.stubEnv('IMPRESSUM_CITY', '12345 Musterstadt');
    vi.stubEnv('IMPRESSUM_EMAIL', 'kontakt@example.com');

    render(<ImpressumPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Impressum');
    expect(screen.getByText(/Erika Mustermann/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'kontakt@example.com' })).toHaveAttribute(
      'href',
      'mailto:kontakt@example.com',
    );
  });

  it('says so when the operator details are not configured', () => {
    vi.stubEnv('IMPRESSUM_NAME', '');

    render(<ImpressumPage />);

    expect(screen.getByText(/in dieser Umgebung nicht hinterlegt/)).toBeInTheDocument();
  });
});
