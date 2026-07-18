import 'server-only';

import { generateItinerary } from '@/lib/ai/generate-itinerary';
import { ItineraryValidationError } from '@/lib/ai/itinerary-schema';
import { persistItineraryVersion } from '@/lib/ai/persist-itinerary';
import type { PreviousActivityContext } from '@/lib/ai/prompt';
import { loadBaseTripAiContext } from '@/lib/ai/trip-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { MAX_REGENERATIONS, type VoteValue } from '@/lib/types/database';
import {
  activityMeetsQuorum,
  isTie,
  quorumThreshold,
  tallyVotes,
} from '@/lib/votes';

export type RegenerateResult =
  | {
      ok: true;
      versionId: string;
      versionNumber: number;
      destination: string;
      activitiesCount: number;
      conflictsCount: number;
      mocked: boolean;
      model: string | null;
      usage: unknown;
    }
  | { ok: false; status: number; error: string; extra?: Record<string, unknown> };

type ActivityRow = {
  id: string;
  day_number: number;
  position: number;
  title: string;
  place_name: string | null;
  category: { slug: string } | null;
};

/**
 * Núcleo de la regeneración (v2/v3). Sin transporte HTTP: lo llaman tanto el
 * Route Handler (para poder probarlo por curl, igual que /generate) como la
 * Server Action del botón de la UI, sin duplicar la lógica en los dos sitios.
 */
export async function regenerateTripItinerary(tripId: string): Promise<RegenerateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: 'No has iniciado sesión.' };

  const { data: trip } = await supabase
    .from('trips')
    .select('id, title, days, budget_mode, group_budget, status, organizer_id, regenerations_used')
    .eq('id', tripId)
    .single();

  if (!trip) return { ok: false, status: 404, error: 'Viaje no encontrado.' };

  if (trip.organizer_id !== user.id) {
    return { ok: false, status: 403, error: 'Solo el organizador puede regenerar el itinerario.' };
  }

  if (trip.status !== 'voting') {
    return { ok: false, status: 409, error: 'El viaje no está en votación ahora mismo.' };
  }

  // --- Lock atómico contra doble-clic o llamadas simultáneas ----------------
  // Un lock en memoria de proceso (una variable, un Map) no serviría aquí: en
  // serverless cada invocación puede caer en una instancia distinta, sin
  // memoria compartida. El mutex vive en la propia fila: este UPDATE solo
  // afecta una fila si el estado sigue siendo 'voting' en el momento exacto
  // de escribir -Postgres serializa los UPDATE concurrentes sobre la misma
  // fila-, así que si dos peticiones llegan casi a la vez, la segunda no
  // encuentra fila que cumpla el WHERE y sale aquí, antes de gastar un solo
  // token en Claude. Se hace pronto, antes del cálculo de quorum, para que
  // quien pierda la carrera no malgaste ni esa consulta.
  const admin = createAdminClient();
  const { data: locked } = await admin
    .from('trips')
    .update({ status: 'generating' })
    .eq('id', tripId)
    .eq('status', 'voting')
    .select('id')
    .single();

  if (!locked) {
    return { ok: false, status: 409, error: 'Ya hay una regeneración en curso para este viaje.' };
  }

  // A partir de aquí el viaje está en 'generating' (lo puso el lock). TODO lo
  // que sigue va dentro de un try/catch: los return de negocio revierten a
  // 'voting' explícitamente vía unlock(), y el catch del final cubre el caso
  // que faltaba -que una consulta o loadBaseTripAiContext LANCE una excepción
  // (un corte de red que rechaza la promesa en vez de devolver {error})-, que
  // antes dejaba el viaje atascado en 'generating' para siempre sin
  // recuperación posible.
  const unlock = () => admin.from('trips').update({ status: 'voting' }).eq('id', tripId);

  try {
    // Comprobación explícita ANTES de tocar Claude: el CHECK de version_number
    // (1-3) ya lo impediría, pero fallar contra un CHECK es un error feo de
    // Postgres, no un mensaje que se le pueda mostrar a nadie.
    if (trip.regenerations_used >= MAX_REGENERATIONS) {
      await unlock();
      return {
        ok: false,
        status: 409,
        error: `Ya se usaron las ${MAX_REGENERATIONS} regeneraciones disponibles para este viaje.`,
      };
    }

    const { data: currentVersion } = await supabase
      .from('itinerary_versions')
      .select('id, version_number')
      .eq('trip_id', tripId)
      .eq('is_current', true)
      .single();

    if (!currentVersion) {
      await unlock();
      return { ok: false, status: 409, error: 'Este viaje todavía no tiene un itinerario generado.' };
    }

    const nextVersionNumber = currentVersion.version_number + 1;
    if (nextVersionNumber > 1 + MAX_REGENERATIONS) {
      await unlock();
      return { ok: false, status: 409, error: 'Se alcanzó el máximo de versiones del itinerario.' };
    }

    // --- Quorum de la ronda de votos ---------------------------------------
    const { data: activitiesData } = await supabase
      .from('itinerary_activities')
      .select('id, day_number, position, title, place_name, category:categories(slug)')
      .eq('version_id', currentVersion.id)
      .order('day_number', { ascending: true })
      .order('position', { ascending: true });

    const activities = (activitiesData ?? []) as unknown as ActivityRow[];
    const activityIds = activities.map((a) => a.id);

    // Participantes ACTUALES (sus ids, no solo el número): los votos de quien
    // ya salió del viaje NO cuentan para el quórum ni alimentan la
    // regeneración. Antes se comparaba el total de votos contra el número de
    // participantes actual, así que si 3 de 4 votaban y luego se iban, sus
    // votos fantasma seguían dando el quórum por cumplido y metían en el
    // prompt las preferencias de gente que ya no está.
    const { data: participantRows } = await supabase
      .from('trip_participants')
      .select('user_id')
      .eq('trip_id', tripId);
    const currentParticipantIds = new Set((participantRows ?? []).map((p) => p.user_id));
    const total = currentParticipantIds.size;

    type VoteRow = { activity_id: string; user_id: string | null; value: VoteValue; comment: string | null };
    let allVotes: VoteRow[] = [];
    if (activityIds.length > 0) {
      const res = await supabase
        .from('votes')
        .select('activity_id, user_id, value, comment')
        .in('activity_id', activityIds);
      allVotes = (res.data ?? []) as VoteRow[];
    }
    const votes = allVotes.filter((v) => v.user_id != null && currentParticipantIds.has(v.user_id));

    const threshold = quorumThreshold(total);
    const tallies = tallyVotes(votes);

    const pendingActivities = activities
      .filter((a) => !activityMeetsQuorum(tallies.get(a.id), threshold))
      .map((a) => a.title);

    if (pendingActivities.length > 0) {
      await unlock();
      return {
        ok: false,
        status: 422,
        error: `Todavía faltan votos suficientes en ${pendingActivities.length} actividad(es) (se necesitan al menos ${threshold} de ${total} participantes por actividad).`,
        extra: { pendingActivities, threshold, totalParticipants: total },
      };
    }

    // --- Construir el contexto de regeneración -----------------------------
    const commentsByActivity = new Map<string, string[]>();
    for (const v of votes) {
      if (v.comment?.trim()) {
        const arr = commentsByActivity.get(v.activity_id) ?? [];
        arr.push(v.comment.trim());
        commentsByActivity.set(v.activity_id, arr);
      }
    }

    const regenActivities: PreviousActivityContext[] = activities.map((a) => {
      const t = tallies.get(a.id);
      return {
        dayNumber: a.day_number,
        position: a.position,
        title: a.title,
        categorySlug: a.category?.slug ?? 'food',
        placeName: a.place_name ?? a.title,
        votesFor: t?.for ?? 0,
        votesAbstain: t?.abstain ?? 0,
        votesAgainst: t?.against ?? 0,
        isTie: isTie(t),
        comments: commentsByActivity.get(a.id) ?? [],
      };
    });

    // Las preferencias ya se congelaron para generar la v1; si alguien se unió
    // tarde y no las rellenó, no bloqueamos la regeneración por eso — el gate
    // de esta ronda es el quorum de votos, no la confirmación de preferencias.
    const { ctx, slugToCategoryId } = await loadBaseTripAiContext(supabase, tripId, trip);
    ctx.regeneration = {
      previousVersionNumber: currentVersion.version_number,
      activities: regenActivities,
    };

    // --- Generar -----------------------------------------------------------
    let result;
    try {
      result = await generateItinerary(ctx);
    } catch (e) {
      await unlock();
      if (e instanceof ItineraryValidationError) {
        return { ok: false, status: 502, error: `La IA devolvió algo que no cuadra: ${e.message}` };
      }
      console.error('[regenerate] fallo llamando a Claude:', e);
      return { ok: false, status: 502, error: 'No se pudo regenerar el itinerario. Inténtalo otra vez.' };
    }

    // --- Escribir ----------------------------------------------------------
    const persisted = await persistItineraryVersion(admin, {
      tripId,
      versionNumber: nextVersionNumber,
      result,
      slugToCategoryId,
    });

    if (!persisted.ok) {
      await unlock();
      return { ok: false, status: 500, error: persisted.error };
    }

    await admin
      .from('trips')
      .update({
        status: 'voting',
        destination: result.data.destination,
        regenerations_used: trip.regenerations_used + 1,
      })
      .eq('id', tripId);

    return {
      ok: true,
      versionId: persisted.versionId,
      versionNumber: nextVersionNumber,
      destination: result.data.destination,
      activitiesCount: result.data.activities.length,
      conflictsCount: result.data.conflicts.length,
      mocked: result.mocked,
      model: result.mocked ? 'mock' : result.model,
      usage: result.usage,
    };
  } catch (e) {
    // Red de seguridad: cualquier excepción inesperada en las consultas o en
    // loadBaseTripAiContext tras haber tomado el lock. Sin esto el viaje se
    // quedaría en 'generating' y todo intento posterior fallaría el WHERE del
    // lock con un 409 permanente.
    await unlock();
    console.error('[regenerate] fallo inesperado tras tomar el lock:', e);
    return { ok: false, status: 500, error: 'No se pudo regenerar el itinerario. Inténtalo otra vez.' };
  }
}
