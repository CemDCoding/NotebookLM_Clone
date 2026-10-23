'use client';

import { RouteError, type ErrorBoundaryProps } from '@/app/_components/route-error';
import './globals.css';

/**
 * Last resort when the root layout itself fails. It replaces that layout, so it brings its own
 * document, styles and title. The system font stands in for the web fonts of the layout, which
 * is enough for a page this rare.
 */
export default function GlobalError({ error, retry }: ErrorBoundaryProps) {
  return (
    <html lang="de">
      <body className="flex min-h-screen flex-col">
        <title>Fehler – Quellenchat</title>
        <main className="flex flex-1 flex-col">
          <RouteError error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
