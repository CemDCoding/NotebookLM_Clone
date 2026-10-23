import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AppError from './error';

describe('AppError', () => {
  it('shows a German message without the internal error text and retries on request', async () => {
    const retry = vi.fn();
    render(<AppError error={new Error('Cannot read properties of undefined')} retry={retry} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Etwas ist schiefgelaufen' }),
    ).toBeVisible();
    expect(screen.queryByText(/Cannot read properties/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fehlerkennung/)).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it('names the digest of a server error so it can be found in the logs', () => {
    const error = Object.assign(new Error('An error occurred in the Server Components render.'), {
      digest: '2785316043',
    });
    render(<AppError error={error} retry={vi.fn()} />);

    expect(screen.getByText('Fehlerkennung: 2785316043')).toBeVisible();
  });

  it('copes with thrown values that are not errors', () => {
    render(<AppError error="kaputt" retry={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Etwas ist schiefgelaufen');
    expect(screen.queryByText('kaputt')).not.toBeInTheDocument();
  });

  it('offers the way back to the notebook overview', () => {
    render(<AppError error={new Error('Boom')} retry={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Zu deinen Notebooks' })).toHaveAttribute(
      'href',
      '/notebooks',
    );
  });
});
