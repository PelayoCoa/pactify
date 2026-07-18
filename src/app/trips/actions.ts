'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { IMAGE_EXT_BY_MIME, MAX_IMAGE_BYTES, storagePathFromPublicUrl } from '@/lib/storage';
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
  redirect(`/trips/${data}?joined=1`);
}

// -- Salir del viaje ---------------------------------------------------------
export async function leaveTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const tripId = String(formData.get('trip_id') ?? '');

  const supabase = await createClient();

  // Si esto acaba borrando el viaje entero (organizador en solitario), la
  // foto de grupo se queda huérfana en Storage -el DELETE en cascada de
  // trips no lo toca, son sistemas distintos-. Se captura la URL antes de
  // llamar al RPC, porque después ya no hay de dónde leerla.
  const { data: tripBefore } = await supabase
    .from('trips')
    .select('photo_url')
    .eq('id', tripId)
    .single();

  const { data, error } = await supabase.rpc('leave_trip', { p_trip_id: tripId });

  if (error) return { error: friendlyDbError(error.message) };

  if (data === 'TRIP_DELETED') {
    const photoPath = tripBefore?.photo_url
      ? storagePathFromPublicUrl(tripBefore.photo_url, 'trip-photos')
      : null;
    if (photoPath) {
      // trip_participants ya se borró en cascada, así que is_trip_participant()
      // ya no vería a nadie: la policy de DELETE del cliente de sesión
      // rechazaría esto. El cliente admin salta esa RLS.
      const admin = createAdminClient();
      await admin.storage.from('trip-photos').remove([photoPath]);
    }
  }

  revalidatePath('/dashboard');
  // Tanto si salió como si se borró el viaje, ya no pinta la ficha.
  redirect(data === 'TRIP_DELETED' ? '/dashboard?left=deleted' : '/dashboard?left=1');
}

// -- Foto de grupo del viaje ---------------------------------------------------
export type TripPhotoResult = { ok: true; photoUrl: string } | { ok: false; error: string };

/**
 * Cualquier participante puede subirla -no solo el organizador-, igual que en
 * un grupo de WhatsApp. La policy de UPDATE de `trips` es organizador-only,
 * así que esto persiste el cambio vía set_trip_photo() (RPC estrecha, ver
 * migración 008) en vez de un .update() directo.
 */
export async function updateTripPhoto(formData: FormData): Promise<TripPhotoResult> {
  const tripId = String(formData.get('trip_id') ?? '');
  const file = formData.get('photo');

  if (!tripId) return { ok: false, error: 'Falta el viaje.' };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Elige una imagen primero.' };
  }

  const ext = IMAGE_EXT_BY_MIME[file.type];
  if (!ext) return { ok: false, error: 'Formato no soportado. Usa JPG, PNG, WEBP o GIF.' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'La imagen pesa demasiado. Máximo 2 MB.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' };

  const { data: current } = await supabase
    .from('trips')
    .select('photo_url')
    .eq('id', tripId)
    .single();

  const path = `${tripId}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('trip-photos')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadErr) return { ok: false, error: 'No se pudo subir la foto. Inténtalo de nuevo.' };

  const { data: publicUrlData } = supabase.storage.from('trip-photos').getPublicUrl(path);
  const photoUrl = publicUrlData.publicUrl;

  const { error: rpcErr } = await supabase.rpc('set_trip_photo', {
    p_trip_id: tripId,
    p_photo_url: photoUrl,
  });

  if (rpcErr) {
    await supabase.storage.from('trip-photos').remove([path]);
    return { ok: false, error: 'No se pudo guardar la foto. Inténtalo de nuevo.' };
  }

  // Última subida gana: si otro participante cambió la foto casi a la vez,
  // esto simplemente borra lo que en ese momento sea "la anterior" para
  // quien la lea justo ahora -sin bloqueo especial, tal como se pidió-.
  const oldPath = current?.photo_url ? storagePathFromPublicUrl(current.photo_url, 'trip-photos') : null;
  if (oldPath) {
    await supabase.storage.from('trip-photos').remove([oldPath]);
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/dashboard');
  return { ok: true, photoUrl };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Cualquier participante puede quitarla, mismo criterio que subirla. Borra el
 * archivo real de Storage -no solo el campo-; si ya no estuviera ahí por lo
 * que sea, se ignora ese resultado y el campo se limpia igual.
 */
export async function removeTripPhoto(tripId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' };

  const { data: current } = await supabase
    .from('trips')
    .select('photo_url')
    .eq('id', tripId)
    .single();

  const path = current?.photo_url ? storagePathFromPublicUrl(current.photo_url, 'trip-photos') : null;
  if (path) {
    await supabase.storage.from('trip-photos').remove([path]);
  }

  const { error } = await supabase.rpc('set_trip_photo', { p_trip_id: tripId, p_photo_url: null });
  if (error) return { ok: false, error: 'No se pudo quitar la foto. Inténtalo de nuevo.' };

  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/dashboard');
  return { ok: true };
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
  // El dashboard agrupa por rol (Organizas/Participas): sin esto, el antiguo
  // organizador seguiría viendo el viaje bajo "Organizas" con caché vieja.
  revalidatePath('/dashboard');
  return {};
}
