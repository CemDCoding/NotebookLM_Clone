import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { ExportButton } from './export-button';

const apiFetchResponse = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetchResponse,
}));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));

const exportData = {
  exportedAt: '2026-10-23T08:00:00.000Z',
  userId: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d',
  notebooks: [],
};

describe('export button', () => {
  beforeEach(() => {
    apiFetchResponse.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:export');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the export as a dated json file', async () => {
    apiFetchResponse.mockResolvedValue(new Response(JSON.stringify(exportData)));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ExportButton />);

    await user.click(screen.getByRole('button', { name: 'Meine Daten exportieren' }));

    await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(apiFetchResponse).toHaveBeenCalledWith('/me/export');
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^quellenchat-export-\d{4}-\d{2}-\d{2}\.json$/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error and downloads nothing when the request fails', async () => {
    apiFetchResponse.mockRejectedValue(new ApiError(500, 'Der Export ist fehlgeschlagen.'));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ExportButton />);

    await user.click(screen.getByRole('button', { name: 'Meine Daten exportieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Export ist fehlgeschlagen.');
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Meine Daten exportieren' })).toBeEnabled();
  });

  it('rejects a response that does not match the export schema', async () => {
    apiFetchResponse.mockResolvedValue(new Response(JSON.stringify({ foo: 1 })));
    const user = userEvent.setup();
    render(<ExportButton />);

    await user.click(screen.getByRole('button', { name: 'Meine Daten exportieren' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Export konnte nicht gelesen');
  });
});
