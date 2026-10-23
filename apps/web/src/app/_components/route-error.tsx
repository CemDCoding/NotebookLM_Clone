'use client';

import { RotateCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { RouteStatus } from './route-status';

/** Props Next.js passes to every `error.tsx`, see `next/dist/docs` „error.js“. */
export interface ErrorBoundaryProps {
  /** Anything may be thrown in a Client Component, so it is not necessarily an `Error`. */
  error: unknown;
  /** Fetches and renders the segment again. */
  retry: () => void;
}

/** Next.js reference to the matching server log entry, set for errors of Server Components. */
function digestOf(error: unknown): string | null {
  if (error instanceof Error && 'digest' in error && typeof error.digest === 'string') {
    return error.digest;
  }
  return null;
}

interface RouteErrorProps extends ErrorBoundaryProps {
  /** Further ways out next to the retry, e.g. a link back. */
  children?: ReactNode;
}

/**
 * Body of the error boundaries. The error message is never shown: it is English and may carry
 * internals. React already reports the caught error to the console, so nothing is logged here.
 */
export function RouteError({ error, retry, children }: RouteErrorProps) {
  const digest = digestOf(error);

  return (
    <RouteStatus
      icon={TriangleAlert}
      tone="destructive"
      title="Etwas ist schiefgelaufen"
      description={
        <>
          <p>Diese Seite konnte nicht angezeigt werden. Bitte versuche es erneut.</p>
          {digest && <p className="mt-2 text-xs">Fehlerkennung: {digest}</p>}
        </>
      }
    >
      <Button onClick={retry}>
        <RotateCw aria-hidden="true" data-icon="inline-start" />
        Erneut versuchen
      </Button>
      {children}
    </RouteStatus>
  );
}
