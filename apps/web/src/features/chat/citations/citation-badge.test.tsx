import type { Citation } from '@notebooklm/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CitationBadge } from './citation-badge';
import { CitationPanelProvider } from './citation-panel-provider';

const CITATION: Citation = {
  n: 2,
  available: true,
  sourceId: '00000000-0000-4000-8000-000000000001',
  chunkId: '00000000-0000-4000-8000-000000000011',
  page: 7,
  sourceTitle: 'Handbuch.pdf',
  excerpt: 'Die Erde ist rund.',
  content: 'Die Erde ist rund. Das zeigen viele Beobachtungen aus aller Welt.',
};

const DELETED: Citation = {
  n: 3,
  available: false,
  sourceId: '00000000-0000-4000-8000-000000000002',
  chunkId: '00000000-0000-4000-8000-000000000022',
  page: null,
};

function renderBadge(citation: Citation) {
  return render(
    <CitationPanelProvider>
      <p>
        Antwort <CitationBadge citation={citation} />
      </p>
    </CitationPanelProvider>,
  );
}

describe('CitationBadge', () => {
  // The hover card positions itself with ResizeObserver, which jsdom does not provide.
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

  it('shows title, page and excerpt on hover', async () => {
    const user = userEvent.setup();
    renderBadge(CITATION);

    await user.hover(screen.getByRole('button', { name: 'Zitat 2' }));

    expect(await screen.findByText('Die Erde ist rund.')).toBeInTheDocument();
    expect(screen.getByText('Handbuch.pdf')).toBeInTheDocument();
    expect(screen.getByText('Seite 7')).toBeInTheDocument();
  });

  it('opens the preview on keyboard focus', async () => {
    const user = userEvent.setup();
    renderBadge(CITATION);

    await user.tab();

    expect(screen.getByRole('button', { name: 'Zitat 2' })).toHaveFocus();
    expect(await screen.findByText('Die Erde ist rund.')).toBeInTheDocument();
  });

  it('opens the side panel with the full section via keyboard and returns focus on close', async () => {
    const user = userEvent.setup();
    renderBadge(CITATION);

    await user.tab();
    await user.keyboard('{Enter}');

    const panel = await screen.findByRole('dialog', { name: 'Handbuch.pdf' });
    expect(panel).toHaveTextContent(CITATION.content);
    expect(panel).toHaveTextContent('Seite 7');
    expect(panel).toHaveTextContent('Zitat 2');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Zitat 2' })).toHaveFocus();
  });

  it('closes the side panel with its close button', async () => {
    const user = userEvent.setup();
    renderBadge(CITATION);

    await user.click(screen.getByRole('button', { name: 'Zitat 2' }));
    await user.click(await screen.findByRole('button', { name: 'Schließen' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('marks a citation of a deleted source in preview and panel', async () => {
    const user = userEvent.setup();
    renderBadge(DELETED);

    await user.hover(screen.getByRole('button', { name: 'Zitat 3' }));
    expect(await screen.findByText('Quelle gelöscht')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zitat 3' }));

    const panel = await screen.findByRole('dialog', { name: 'Quelle gelöscht' });
    expect(panel).toHaveTextContent('nicht mehr verfügbar');
  });
});
