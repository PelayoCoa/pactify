'use server';

import { revalidatePath } from 'next/cache';

import { regenerateTripItinerary } from '@/lib/ai/regenerate-service';
import { createClient } from '@/lib/supabase/server';
import type { VoteValue } from '@/lib/types/database';

export type ActionResult = { ok: true } | { ok: false; error: string };

function friendlyDbError(message: string): string {
  if (message.includes('VOTE_ON_OLD_VERSION'))
    return 'Esta versión del itinerario ya no está en votación. Recarga la página.';
  if (message.includes('VOTING_CLOSED'))
    return 'La votación de este viaje ya se cerró.';
  return message;
}

export type CastVoteInput = {
  tripId: string;
  activityId: string;
  value: VoteValue;
  comment?: string | null;
};

/** Autoguardado del voto. Se puede cambiar tantas veces como se quiera mientras la ronda esté abierta. */
export async function castVote(input: CastVoteInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' };

  const { error } = await supabase.from('votes').upsert(
    {
      activity_id: input.activityId,
      user_id: user.id,
      value: input.value,
      comment: input.comment?.trim() ? input.comment.trim() : null,
    },
    { onConflict: 'activity_id,user_id' },
  );

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  revalidatePath(`/trips/${input.tripId}/vote`);
  return { ok: true };
}

/** El organizador cierra la votación y se queda con el itinerario actual tal cual. */
export async function finalizeVoting(tripId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' };

  const { data: trip } = await supabase
    .from('trips')
    .select('organizer_id, status')
    .eq('id', tripId)
    .single();

  if (!trip) return { ok: false, error: 'Viaje no encontrado.' };
  if (trip.organizer_id !== user.id) {
    return { ok: false, error: 'Solo el organizador puede cerrar la votación.' };
  }
  if (trip.status !== 'voting') {
    return { ok: false, error: 'El viaje no está en votación ahora mismo.' };
  }

  const { error } = await supabase
    .from('trips')
    .update({ status: 'finalized' })
    .eq('id', tripId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/trips/${tripId}/vote`);
  revalidatePath(`/trips/${tripId}`);
  // El badge de estado del viaje aparece también en el dashboard.
  revalidatePath('/dashboard');
  return { ok: true };
}

export type RegenerateActionResult =
  | { ok: true; versionNumber: number }
  | { ok: false; error: string; extra?: Record<string, unknown> };

/** Envoltorio de Server Action del botón: llama al mismo servicio que el endpoint /regenerate. */
export async function regenerateAction(tripId: string): Promise<RegenerateActionResult> {
  const result = await regenerateTripItinerary(tripId);

  if (!result.ok) {
    return { ok: false, error: result.error, extra: result.extra };
  }

  revalidatePath(`/trips/${tripId}/vote`);
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, versionNumber: result.versionNumber };
}
