import type { Source } from '@notebooklm/shared';

export type ChatAvailability = { canAsk: true } | { canAsk: false; reason: string };

/** What the chat knows about the sources: the source list query, reduced to what matters here. */
export type SourcesState =
  { status: 'pending' } | { status: 'error' } | { status: 'success'; sources: readonly Source[] };

/**
 * Whether a question can be asked, and if not, why. The API answers `409` without an active,
 * ready source; checking here first explains the reason before anyone types a question.
 */
export function chatAvailability(state: SourcesState): ChatAvailability {
  if (state.status === 'pending') {
    return { canAsk: false, reason: 'Die Quellen werden geladen …' };
  }
  if (state.status === 'error') {
    return {
      canAsk: false,
      reason: 'Die Quellen konnten nicht geladen werden. Lade sie erneut, um Fragen zu stellen.',
    };
  }

  const { sources } = state;
  if (sources.length === 0) {
    return { canAsk: false, reason: 'Füge zuerst eine Quelle hinzu, um Fragen zu stellen.' };
  }
  const active = sources.filter((source) => source.isActive);
  if (active.some((source) => source.status === 'ready')) {
    return { canAsk: true };
  }
  if (active.some((source) => source.status === 'pending' || source.status === 'processing')) {
    return {
      canAsk: false,
      reason:
        'Deine Quellen werden noch verarbeitet. Sobald eine aktive Quelle bereit ist, kannst du fragen.',
    };
  }
  return {
    canAsk: false,
    reason: 'Aktiviere mindestens eine fertige Quelle, um Fragen zu stellen.',
  };
}
