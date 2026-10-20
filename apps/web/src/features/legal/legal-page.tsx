import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';

interface LegalPageProps {
  title: string;
  children: ReactNode;
}

/** Shared frame of the legal notice and the privacy policy. */
export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
        <Link
          href="/"
          className="flex w-fit items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Zur Startseite
        </Link>
        <h1 className="font-heading text-4xl font-semibold tracking-tight">{title}</h1>
        <div className="flex flex-col gap-8 leading-relaxed">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
