import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only pages whose access depends on the session (see lib/supabase/route-access.ts).
  // Public legal pages and static assets skip the Supabase round trip.
  matcher: ['/', '/login', '/notebooks/:path*', '/settings/:path*'],
};
