import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/types/database';

/**
 * Cliente con service_role: SALTA RLS por completo.
 *
 * Úsalo solo en el servidor y solo donde el usuario no debe poder escribir a
 * mano: insertar el itinerario que devuelve Claude, y poco más. Cualquier otra
 * cosa debe pasar por el cliente normal para que RLS haga su trabajo.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
