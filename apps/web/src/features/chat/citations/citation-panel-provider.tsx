'use client';

import type { Citation } from '@notebooklm/shared';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CitationPanel } from './citation-panel';

interface CitationPanelContextValue {
  /** Opens the panel; focus returns to `returnFocusTo` when it closes. */
  openCitation: (citation: Citation, returnFocusTo?: HTMLElement) => void;
}

const CitationPanelContext = createContext<CitationPanelContextValue | null>(null);

interface CitationPanelProviderProps {
  children: React.ReactNode;
}

/**
 * Owns the single citation side panel of a chat. Every badge below it opens the panel through
 * `useCitationPanel`, so a long answer does not mount one sheet per citation.
 */
export function CitationPanelProvider({ children }: CitationPanelProviderProps) {
  const [citation, setCitation] = useState<Citation | null>(null);
  const [open, setOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openCitation = useCallback((next: Citation, returnFocusTo?: HTMLElement) => {
    returnFocusRef.current = returnFocusTo ?? null;
    setCitation(next);
    setOpen(true);
  }, []);

  // The panel has no Radix trigger, so Radix cannot restore focus by itself. Keyboard users
  // land on the badge they came from instead of the start of the page.
  const handleCloseAutoFocus = useCallback((event: Event) => {
    const target = returnFocusRef.current;
    if (target?.isConnected) {
      event.preventDefault();
      target.focus();
    }
    returnFocusRef.current = null;
  }, []);

  const value = useMemo(() => ({ openCitation }), [openCitation]);

  return (
    <CitationPanelContext.Provider value={value}>
      {children}
      <CitationPanel
        citation={citation}
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={handleCloseAutoFocus}
      />
    </CitationPanelContext.Provider>
  );
}

export function useCitationPanel(): CitationPanelContextValue {
  const context = useContext(CitationPanelContext);
  if (!context) {
    throw new Error('useCitationPanel must be used within a CitationPanelProvider');
  }
  return context;
}
