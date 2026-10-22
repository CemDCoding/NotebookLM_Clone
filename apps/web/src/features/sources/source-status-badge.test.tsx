import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SourceStatusBadge } from './source-status-badge';

const RETRY_HINT = 'Bitte lösche die Quelle und lade sie erneut hoch.';

describe('SourceStatusBadge', () => {
  // The tooltip measures its arrow with ResizeObserver, which jsdom does not provide.
  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('shows the failure reason and the retry hint when the failed badge is hovered', async () => {
    const user = userEvent.setup();
    render(<SourceStatusBadge status="failed" error="Die PDF enthält keinen Text." />);

    await user.hover(screen.getByRole('button', { name: /fehlgeschlagen/ }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Die PDF enthält keinen Text.');
    expect(tooltip).toHaveTextContent(RETRY_HINT);
  });

  it('opens the failure reason for keyboard users on focus', async () => {
    const user = userEvent.setup();
    render(<SourceStatusBadge status="failed" error="Die PDF enthält keinen Text." />);

    await user.tab();

    expect(screen.getByRole('button', { name: /fehlgeschlagen/ })).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Die PDF enthält keinen Text.');
  });

  it('falls back to a general reason when the API gives none', async () => {
    const user = userEvent.setup();
    render(<SourceStatusBadge status="failed" error={null} />);

    await user.tab();

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Die Quelle konnte nicht verarbeitet werden.');
    expect(tooltip).toHaveTextContent(RETRY_HINT);
  });

  it.each(['pending', 'processing', 'ready'] as const)(
    'renders the %s status without an interactive tooltip',
    (status) => {
      render(<SourceStatusBadge status={status} error="ignored" />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByText('ignored')).not.toBeInTheDocument();
    },
  );
});
