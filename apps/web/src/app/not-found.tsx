import { ArrowLeft, MapPinOff } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { RouteStatus } from '@/app/_components/route-status';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  // The root layout's title template only applies to nested segments, not to this file beside it.
  title: { absolute: 'Seite nicht gefunden – Quellenchat' },
};

/**
 * Unknown URLs. Rendered outside the app layout, so it wears the frame of the public pages. The
 * start page sends signed-in users on to their notebooks.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col">
        <RouteStatus
          icon={MapPinOff}
          title="Seite nicht gefunden"
          description="Diese Adresse gibt es nicht. Prüfe den Link oder geh zurück zur Startseite."
        >
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft aria-hidden="true" data-icon="inline-start" />
              Zur Startseite
            </Link>
          </Button>
        </RouteStatus>
      </main>
      <SiteFooter />
    </div>
  );
}
