import { BookOpenText, Settings } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/features/auth/logout-button';
import { NOTEBOOKS_PATH } from '@/lib/supabase/route-access';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Frame of all pages behind the login. Access is checked by proxy.ts for navigation and by
 * the API for every data request; this layout holds no data that would need protection itself.
 * Pages render inside its `<main>` and therefore must not add their own.
 */
export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-6">
          <Link
            href={NOTEBOOKS_PATH}
            className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight"
          >
            <span className="flex size-7 items-center justify-center rounded-lg border bg-primary-soft text-primary-soft-foreground">
              <BookOpenText aria-hidden="true" className="size-4" />
            </span>
            <span>
              Quellen<span className="font-serif font-normal italic">chat</span>
            </span>
          </Link>
          <nav aria-label="Konto" className="flex items-center gap-1">
            <Button asChild variant="ghost">
              <Link href="/settings">
                <Settings aria-hidden="true" data-icon="inline-start" />
                Einstellungen
              </Link>
            </Button>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
