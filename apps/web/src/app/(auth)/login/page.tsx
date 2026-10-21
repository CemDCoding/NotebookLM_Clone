import { BookOpenText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { Card, CardContent } from '@/components/ui/card';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = {
  title: 'Anmelden – Quellenchat',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <Link
              href="/"
              aria-label="Zur Startseite"
              className="flex size-12 items-center justify-center rounded-xl border bg-primary-soft text-primary-soft-foreground"
            >
              <BookOpenText aria-hidden="true" className="size-6" />
            </Link>
            <div className="flex flex-col gap-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight">
                Bei Quellen<span className="font-serif font-normal italic">chat</span> anmelden
              </h1>
              <p className="text-muted-foreground">
                Melde dich mit deiner E-Mail-Adresse und deinem Passwort an.
              </p>
            </div>
          </div>

          <Card>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Zugänge werden vom Betreiber vergeben. Eine Registrierung gibt es nicht.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
