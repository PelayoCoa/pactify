import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@/lib/types/database';

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * En Next 16 `cookies()` es async, así que esto también lo es: `await createClient()`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Los Server Components no pueden escribir cookies. No pasa nada:
            // el middleware ya refresca la sesión en cada request.
          }
        },
      },
    },
  );
}
