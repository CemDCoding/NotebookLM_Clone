import { BookOpenText, LogIn } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="flex max-w-2xl flex-col items-center gap-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl border bg-primary-soft text-primary-soft-foreground">
          <BookOpenText aria-hidden="true" className="size-6" />
        </span>

        <div className="flex flex-col gap-4">
          <h1 className="font-heading text-5xl font-semibold tracking-tight">
            NotebookLM-<span className="font-serif font-normal italic">Klon</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Sprich mit deinen eigenen Dokumenten. Jede Antwort stützt sich nur auf deine Quellen und
            ist mit prüfbaren Zitaten belegt.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button asChild size="lg" className="px-4">
            <Link href="/login">
              <LogIn aria-hidden="true" data-icon="inline-start" />
              Anmelden
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Eine Registrierung gibt es nicht. Zugänge werden vergeben.
          </p>
        </div>
      </div>
    </main>
  );
}
