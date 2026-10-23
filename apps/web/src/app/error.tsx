'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { RouteError, type ErrorBoundaryProps } from '@/app/_components/route-error';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';

/**
 * Unexpected errors of the public pages and of the app layout, which its own boundary does not
 * cover. It wears the frame of the public pages; errors of the root layout need `global-error`.
 */
export default function RootError({ error, retry }: ErrorBoundaryProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col">
        <RouteError error={error} retry={retry}>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft aria-hidden="true" data-icon="inline-start" />
              Zur Startseite
            </Link>
          </Button>
        </RouteError>
      </main>
      <SiteFooter />
    </div>
  );
}
