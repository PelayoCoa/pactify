'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };

function friendlyDbError(message: string): string {
  if (message.includes('duplicate key') || message.includes('destination_proposals_trip_id_user_id_name_key'))
    return 'Ya propusiste ese destino.';
  return message;
}

export type AddProposalInput = {
  tripId: string;
  name: string;
  country: string | null;
  notes: string | null;
  lat: number;
  lon: number;
};

export async function addDestinationProposal(input: AddProposalInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' };

  const { error } = await supabase.from('destination_proposals').insert({
    trip_id: input.tripId,
    user_id: user.id,
    name: input.name,
    country: input.country,
    notes: input.notes,
    lat: input.lat,
    lon: input.lon,
  });

  if (error) return { ok: false, error: friendlyDbError(error.message) };

  revalidatePath(`/trips/${input.tripId}/destinations`);
  return { ok: true };
}

export async function removeDestinationProposal(
  tripId: string,
  proposalId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' };

  // .eq('user_id') es defensa en profundidad (la policy RLS ya lo exige), y
  // .select() devuelve las filas borradas: un delete que no toca ninguna fila
  // (no era tuya, o ya no existía) devolvía antes { ok: true } silenciosamente
  // y la UI decía "retirada" sobre algo que reaparecía al recargar.
  const { data, error } = await supabase
    .from('destination_proposals')
    .delete()
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'No se pudo retirar la propuesta (o ya no existía).' };
  }

  revalidatePath(`/trips/${tripId}/destinations`);
  return { ok: true };
}
