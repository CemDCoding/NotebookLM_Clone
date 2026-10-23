'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { RouteError, type ErrorBoundaryProps } from '@/app/_components/route-error';
import { Button } from '@/components/ui/button';
import { NOTEBOOKS_PATH } from '@/lib/supabase/route-access';

/**
 * Unexpected errors of the pages behind the login. Rendered inside the app layout, so header and
 * logout stay usable. Failed API requests do not end up here; the views show those themselves.
 */
export default function AppError({ error, retry }: ErrorBoundaryProps) {
  return (
    <RouteError error={error} retry={retry}>
      <Button asChild variant="outline">
        <Link href={NOTEBOOKS_PATH}>
          <ArrowLeft aria-hidden="true" data-icon="inline-start" />
          Zu deinen Notebooks
        </Link>
      </Button>
    </RouteError>
  );
}
