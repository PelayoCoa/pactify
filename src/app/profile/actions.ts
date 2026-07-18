'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { IMAGE_EXT_BY_MIME, MAX_IMAGE_BYTES, storagePathFromPublicUrl } from '@/lib/storage';

export type ActionResult = { ok: true } | { ok: false; error: string };

const CONFIRMATION_PHRASE = 'ELIMINAR';

// -- Editar el nombre ---------------------------------------------------------
export async function updateDisplayName(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: 'El nombre no puede estar vacío.' };
  if (trimmed.length > 60) return { ok: false, error: 'El nombre es demasiado largo (máximo 60 caracteres).' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' };

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'No se pudo guardar el nombre. Inténtalo de nuevo.' };

  revalidatePath('/profile');
  return { ok: true };
}

// -- Subir foto de perfil ------------------------------------------------------
export type AvatarResult = { ok: true; avatarUrl: string } | { ok: false; error: string };

/**
 * Sube el archivo a Storage y solo DESPUÉS de que la subida termine bien
 * actualiza avatar_url. Si la subida falla a mitad (conexión, etc.), la fila
 * de profiles nunca llega a apuntar a un archivo que no llegó a existir del
 * todo -y si lo que falla es el UPDATE tras una subida que sí funcionó, se
 * borra el archivo recién subido para no dejarlo huérfano-.
 */
export async function updateAvatar(formData: FormData): Promise<AvatarResult> {
  const file = formData.get('avatar');
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
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single();

  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadErr) return { ok: false, error: 'No se pudo subir la foto. Inténtalo de nuevo.' };

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = publicUrlData.publicUrl;

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id);

  if (updateErr) {
    await supabase.storage.from('avatars').remove([path]);
    return { ok: false, error: 'No se pudo guardar la foto. Inténtalo de nuevo.' };
  }

  const oldPath = current?.avatar_url ? storagePathFromPublicUrl(current.avatar_url, 'avatars') : null;
  if (oldPath) {
    await supabase.storage.from('avatars').remove([oldPath]);
  }

  revalidatePath('/profile');
  return { ok: true, avatarUrl };
}

// -- Quitar la foto de perfil --------------------------------------------------
/**
 * Vuelve al círculo con inicial: borra el archivo real de Storage -no solo el
 * campo en profiles-. Si el archivo ya no estuviera en Storage por lo que sea
 * (borrado externo, inconsistencia), remove() no bloquea nada: se ignora su
 * resultado y el campo se limpia igualmente.
 */
export async function removeAvatar(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' };

  const { data: current } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single();

  const path = current?.avatar_url ? storagePathFromPublicUrl(current.avatar_url, 'avatars') : null;
  if (path) {
    await supabase.storage.from('avatars').remove([path]);
  }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'No se pudo quitar la foto. Inténtalo de nuevo.' };

  revalidatePath('/profile');
  return { ok: true };
}

/**
 * Borra la cuenta del usuario autenticado. Irreversible.
 *
 * Orden de operaciones, y por qué importa:
 *
 *   1. Primero resuelve, con el cliente de SESIÓN (RLS activo), cada viaje
 *      donde el usuario es organizador: si hay más gente, transfiere el rol
 *      (reutilizando transfer_organizer(), la misma función del día 2, al
 *      participante más antiguo); si estaba solo, borra el viaje entero
 *      (reutilizando leave_trip(), que ya sabe hacer justo eso). Ninguna de
 *      las dos es lógica nueva.
 *
 *   2. Solo al final, con el cliente service_role, borra de verdad la fila de
 *      auth.users. Eso dispara en cascada: profiles se borra (FK a
 *      auth.users), y de ahí preferences/preference_categories y
 *      trip_participants (FK a profiles, ON DELETE CASCADE — es justo lo que
 *      se pidió: preferencias fuera de verdad). votes y destination_proposals
 *      sobreviven con user_id a null (ON DELETE SET NULL, migración 006):
 *      anonimizados, no borrados. trips.organizer_id es ON DELETE RESTRICT
 *      como red de seguridad — si el paso 1 hiciera bien su trabajo, nunca
 *      debería llegar a dispararse.
 *
 * Si el paso 1 fallara a mitad (p. ej. se cae la conexión tras transferir 2
 * de 3 viajes), el usuario simplemente puede reintentar: transferir un viaje
 * que ya no organiza no hace nada raro, vuelve a intentarlo sin más.
 */
export async function deleteMyAccount(confirmationText: string): Promise<ActionResult> {
  if (confirmationText.trim().toUpperCase() !== CONFIRMATION_PHRASE) {
    return { ok: false, error: `Escribe "${CONFIRMATION_PHRASE}" exactamente para confirmar.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' };

  // --- 1. Resolver cada viaje donde soy organizador -------------------------
  const { data: organizedTrips, error: tripsErr } = await supabase
    .from('trips')
    .select('id')
    .eq('organizer_id', user.id);

  if (tripsErr) {
    return { ok: false, error: `No se pudo comprobar tus viajes: ${tripsErr.message}` };
  }

  // service_role desde ya: si un viaje se borra entero en el paso 1, su foto
  // de grupo hay que limpiarla de Storage, y para entonces la fila de
  // trip_participants ya habrá desaparecido en cascada -is_trip_participant()
  // ya no vería al usuario como participante-, así que la policy de DELETE
  // de storage.objects (que exige seguir siendo participante) rechazaría al
  // cliente de sesión. El cliente admin salta esa RLS.
  const admin = createAdminClient();

  for (const trip of organizedTrips ?? []) {
    const { data: others, error: othersErr } = await supabase
      .from('trip_participants')
      .select('user_id, joined_at')
      .eq('trip_id', trip.id)
      .neq('user_id', user.id)
      .order('joined_at', { ascending: true });

    if (othersErr) {
      return { ok: false, error: `No se pudo revisar los participantes de un viaje: ${othersErr.message}` };
    }

    if (others && others.length > 0) {
      // El más antiguo del grupo (aparte de mí) hereda el rol. Sin señal
      // alguna sobre quién "debería" organizarlo, la antigüedad en el viaje
      // es el criterio menos arbitrario disponible.
      const { error: transferErr } = await supabase.rpc('transfer_organizer', {
        p_trip_id: trip.id,
        p_new_organizer: others[0].user_id,
      });
      if (transferErr) {
        return { ok: false, error: `No se pudo transferir la organización de un viaje: ${transferErr.message}` };
      }
    } else {
      // Estaba solo en ese viaje: se borra entero, igual que "salir" ya hacía.
      // La foto de grupo se captura ANTES del RPC porque, una vez borrada la
      // fila, ya no queda de dónde leerla.
      const { data: tripBefore } = await supabase
        .from('trips')
        .select('photo_url')
        .eq('id', trip.id)
        .single();

      const { error: leaveErr } = await supabase.rpc('leave_trip', { p_trip_id: trip.id });
      if (leaveErr) {
        return { ok: false, error: `No se pudo cerrar uno de tus viajes en solitario: ${leaveErr.message}` };
      }

      const photoPath = tripBefore?.photo_url
        ? storagePathFromPublicUrl(tripBefore.photo_url, 'trip-photos')
        : null;
      if (photoPath) {
        await admin.storage.from('trip-photos').remove([photoPath]);
      }
    }
  }

  // --- 2. Borrado real en auth.users. Solo esto necesita service_role ------

  // El borrado en cascada de profiles no toca Storage -son sistemas
  // separados, sin FK entre ellos-, así que si no se hace explícito aquí la
  // foto se queda huérfana en el bucket para siempre. Se captura la URL
  // antes de borrar la fila y se limpia con el cliente admin (la sesión del
  // usuario está a punto de invalidarse).
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single();

  const avatarPath = myProfile?.avatar_url ? storagePathFromPublicUrl(myProfile.avatar_url, 'avatars') : null;
  if (avatarPath) {
    await admin.storage.from('avatars').remove([avatarPath]);
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id, false);

  if (deleteErr) {
    console.error('[deleteMyAccount] fallo borrando de auth.users:', deleteErr);
    return { ok: false, error: 'No se pudo completar el borrado. Inténtalo de nuevo.' };
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // La sesión ya no tiene usuario detrás; no pasa nada si esto falla.
  }

  redirect('/');
}
