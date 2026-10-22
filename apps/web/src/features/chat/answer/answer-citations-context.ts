'use client';

import type { Citation } from '@notebooklm/shared';
import { createContext, useContext } from 'react';

/**
 * Citations of the answer being rendered, by number. A context instead of a closure keeps the
 * Markdown component map stable, so badges are not remounted with every streamed token.
 */
export const AnswerCitationsContext = createContext<ReadonlyMap<number, Citation>>(new Map());

export function useAnswerCitation(n: number): Citation | undefined {
  return useContext(AnswerCitationsContext).get(n);
}
