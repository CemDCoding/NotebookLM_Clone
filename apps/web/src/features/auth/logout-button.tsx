'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LOGIN_PATH } from '@/lib/supabase/route-access';

export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    // Local scope: the demo account is shared, a global sign-out would end every reviewer's session.
    const { error } = await createSupabaseBrowserClient().auth.signOut({ scope: 'local' });
    if (error) {
      setIsPending(false);
      toast.error('Die Abmeldung hat nicht geklappt. Bitte versuche es erneut.');
      return;
    }

    // Drop the cached data of this session before anyone else can see it.
    queryClient.clear();
    router.replace(LOGIN_PATH);
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={handleLogout} disabled={isPending}>
      <LogOut aria-hidden="true" data-icon="inline-start" />
      Abmelden
    </Button>
  );
}
