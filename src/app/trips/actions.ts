'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { BudgetMode } from '@/lib/types/database';

export type TripFormState = { error?: string };

/** Traduce el errcode/mensaje de las funciones de Postgres a algo legible. */
function friendlyDbError(message: string): string {
  if (message.includes('INVALID_CODE')) return 'Ese código no existe. Revísalo.';
  if (message.includes('ORGANIZER_MUST_TRANSFER'))
    return 'Eres el organizador. Pasa el rol a otra persona antes de salir.';
  if (message.includes('NOT_PARTICIPANT')) return 'No estás en este viaje.';
  if (message.includes('NOT_ORGANIZER')) return 'Solo el organizador puede hacer eso.';
  if (message.includes('NEW_ORGANIZER_NOT_PARTICIPANT'))
    return 'Esa persona no está en el viaje.';
  return message;
}

// -- Crear viaje -------------------------------------------------------------
export async function createTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const title = String(formData.get('title') ?? '').trim();
  const budgetMode = String(formData.get('budget_mode') ?? '') as BudgetMode;
  const days = Number(formData.get('days'));
  const groupBudgetRaw = String(formData.get('group_budget') ?? '').trim();

  if (title.length < 2) return { error: 'Ponle un nombre al viaje.' };
  if (budgetMode !== 'individual' && budgetMode !== 'group')
    return { error: 'Elige el tipo de presupuesto.' };
  if (!Number.isInteger(days) || days < 1 || days > 30)
    return { error: 'Los días deben estar entre 1 y 30.' };

  // El schema obliga group_budget cuando el modo es de grupo (y null si no).
  let groupBudget: number | null = null;
  if (budgetMode === 'group') {
    groupBudget = Number(groupBudgetRaw);
    if (!Number.isFinite(groupBudget) || groupBudget < 0)
      return { error: 'Pon el bote común (un número ≥ 0).' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('trips')
    .insert({
      organizer_id: user.id,
      title,
      budget_mode: budgetMode,
      days,
      group_budget: groupBudget,
    })
    .select('id')
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath('/dashboard');
  redirect(`/trips/${data.id}`);
}

// -- Unirse por código -------------------------------------------------------
export async function joinTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const code = String(formData.get('code') ?? '').trim();
  if (code.length < 4) return { error: 'Pega el código de invitación.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_trip', { p_code: code });

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath('/dashboard');
  redirect(`/trips/${data}`);
}

// -- Salir del viaje ---------------------------------------------------------
export async function leaveTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const tripId = String(formData.get('trip_id') ?? '');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('leave_trip', { p_trip_id: tripId });

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath('/dashboard');
  // Tanto si salió como si se borró el viaje, ya no pinta la ficha.
  redirect(data === 'TRIP_DELETED' ? '/dashboard?left=deleted' : '/dashboard?left=1');
}

// -- Transferir organizador --------------------------------------------------
export async function transferOrganizer(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const tripId = String(formData.get('trip_id') ?? '');
  const newOrganizer = String(formData.get('new_organizer') ?? '');
  if (!newOrganizer) return { error: 'Elige a quién le pasas el rol.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('transfer_organizer', {
    p_trip_id: tripId,
    p_new_organizer: newOrganizer,
  });

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath(`/trips/${tripId}`);
  return {};
}
