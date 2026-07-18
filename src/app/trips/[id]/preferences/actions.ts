'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import type { CategoryStance } from '@/lib/types/database';

export type ActionResult = { ok: true } | { ok: false; error: string };

function friendlyDbError(message: string): string {
  if (message.includes('PREFERENCES_LOCKED'))
    return 'Ya confirmaste tus preferencias. No se puede editar.';
  return message;
}

export type SaveDraftInput = {
  tripId: string;
  budgetAmount: number | null;
  vetoes: string | null;
  stances: Record<string, CategoryStance>;
};

/** Autoguardado de borrador. Se llama directamente desde el cliente, sin form. */
export async function saveDraft(input: SaveDraftInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' };

  const { data: pref, error: prefErr } = await supabase
    .from('preferences')
    .upsert(
      {
        trip_id: input.tripId,
        user_id: user.id,
        budget_amount: input.budgetAmount,
        vetoes: input.vetoes,
      },
      { onConflict: 'trip_id,user_id' },
    )
    .select('id')
    .single();

  if (prefErr || !pref) {
    return { ok: false, error: friendlyDbError(prefErr?.message ?? 'No se pudo guardar.') };
  }

  const rows = Object.entries(input.stances).map(([categoryId, stance]) => ({
    preference_id: pref.id,
    category_id: categoryId,
    stance,
  }));

  if (rows.length > 0) {
    const { error: catErr } = await supabase
      .from('preference_categories')
      .upsert(rows, { onConflict: 'preference_id,category_id' });
    if (catErr) return { ok: false, error: friendlyDbError(catErr.message) };
  }

  return { ok: true };
}

/** Confirma: pone submitted_at y a partir de ahí el trigger bloquea más escrituras. */
export async function submitPreferences(tripId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' };

  const { data, error } = await supabase
    .from('preferences')
    .update({ submitted_at: new Date().toISOString() })
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .is('submitted_at', null)
    .select('submitted_at')
    .single();

  if (error) return { ok: false, error: friendlyDbError(error.message) };
  if (!data) return { ok: false, error: 'Ya estaba confirmado.' };

  revalidatePath(`/trips/${tripId}/preferences`);
  return { ok: true };
}
