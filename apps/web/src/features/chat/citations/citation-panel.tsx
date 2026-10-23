'use client';

import type { Citation } from '@notebooklm/shared';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet';
import { CitationPanelBody } from './citation-panel-body';

interface CitationPanelProps {
  /** Kept while the panel closes, so the content does not vanish during the animation. */
  citation: Citation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Radix moves focus here when the panel closes; it was opened without a trigger element. */
  onCloseAutoFocus: (event: Event) => void;
}

/** Side panel with the complete cited section, its source title and page. No PDF viewer. */
export function CitationPanel({
  citation,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: CitationPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        className="gap-0 data-[side=right]:sm:max-w-lg"
      >
        {citation && <CitationPanelBody citation={citation} />}
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-3 right-3"
            aria-label="Schließen"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
