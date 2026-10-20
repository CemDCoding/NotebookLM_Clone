'use client';

import type { AuthError } from '@supabase/supabase-js';
import { LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { NOTEBOOKS_PATH } from '@/lib/supabase/route-access';

function toLoginErrorMessage(error: Pick<AuthError, 'code'>): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'E-Mail-Adresse oder Passwort ist falsch. Bitte prüfe deine Eingaben.';
    case 'over_request_rate_limit':
      return 'Zu viele Anmeldeversuche. Bitte warte einen Moment und versuche es dann erneut.';
    default:
      return 'Die Anmeldung hat nicht geklappt. Bitte versuche es später erneut.';
  }
}

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** Email and password only: accounts are created by the operator, so there is nothing else. */
export function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setIsPending(true);
    setErrorMessage(null);

    const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({
      email: readField(formData, 'email').trim(),
      password: readField(formData, 'password'),
    });

    if (error) {
      setErrorMessage(toLoginErrorMessage(error));
      setIsPending(false);
      return;
    }

    // The button stays disabled until the notebooks page has loaded.
    router.replace(NOTEBOOKS_PATH);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        <LogIn aria-hidden="true" data-icon="inline-start" />
        {isPending ? 'Anmeldung läuft …' : 'Anmelden'}
      </Button>
    </form>
  );
}
