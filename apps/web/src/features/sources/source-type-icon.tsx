import type { SourceType } from '@notebooklm/shared';
import { ClipboardPaste, FileCode, FileText, type LucideIcon } from 'lucide-react';

const TYPE_APPEARANCE: Record<SourceType, { label: string; icon: LucideIcon }> = {
  pdf: { label: 'PDF', icon: FileText },
  text: { label: 'Textdatei', icon: FileText },
  markdown: { label: 'Markdown', icon: FileCode },
  pasted: { label: 'Eingefügter Text', icon: ClipboardPaste },
};

interface SourceTypeIconProps {
  type: SourceType;
}

/** Icon of the source type; screen readers get the type as text instead. */
export function SourceTypeIcon({ type }: SourceTypeIconProps) {
  const { label, icon: Icon } = TYPE_APPEARANCE[type];
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-primary-soft text-primary-soft-foreground">
      <Icon aria-hidden="true" className="size-4" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
