import type { Source, SourceStatus } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { chatAvailability } from './chat-availability';

function source(status: SourceStatus, isActive = true): Source {
  return {
    id: '0b5d7c1e-1a2b-4c3d-8e4f-5a6b7c8d9e01',
    notebookId: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d',
    type: 'pasted',
    title: 'Notizen',
    status,
    error: null,
    isActive,
    createdAt: '2026-10-21T09:30:00.000Z',
  };
}

function reasonFor(sources: Source[]): string | undefined {
  const availability = chatAvailability({ status: 'success', sources });
  return availability.canAsk ? undefined : availability.reason;
}

describe('chatAvailability', () => {
  it('allows questions once an active source is ready', () => {
    expect(
      chatAvailability({ status: 'success', sources: [source('failed'), source('ready')] }),
    ).toEqual({ canAsk: true });
  });

  it('asks for a source when the notebook has none', () => {
    expect(reasonFor([])).toMatch(/Füge zuerst eine Quelle hinzu/);
  });

  it('asks to wait while active sources are still being processed', () => {
    expect(reasonFor([source('pending'), source('processing')])).toMatch(/noch verarbeitet/);
  });

  it('asks to activate a source when only inactive ones are ready', () => {
    expect(reasonFor([source('ready', false), source('failed')])).toMatch(
      /Aktiviere mindestens eine fertige Quelle/,
    );
  });

  it('blocks questions while the sources load or after loading failed', () => {
    expect(chatAvailability({ status: 'pending' }).canAsk).toBe(false);
    expect(chatAvailability({ status: 'error' })).toEqual({
      canAsk: false,
      reason: expect.stringMatching(/konnten nicht geladen werden/),
    });
  });
});
