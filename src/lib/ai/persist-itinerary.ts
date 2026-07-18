import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ItineraryResponse } from '@/lib/ai/itinerary-schema';
import type { Database } from '@/lib/types/database';

export type PersistResult =
  | { ok: true; versionId: string }
  | { ok: false; error: string };

/**
 * Inserta la versión + sus actividades con el cliente service_role (RLS de
 * itinerary_versions/itinerary_activities es de solo lectura para clientes).
 *
 * Compartido entre /generate (v1) y /regenerate (v2/v3): es exactamente la
 * misma secuencia insert-versión → insert-actividades → rollback-si-falla en
 * los dos sitios, así que vive en un solo lugar.
 */
export async function persistItineraryVersion(
  admin: SupabaseClient<Database>,
  params: {
    tripId: string;
    versionNumber: number;
    result: { data: ItineraryResponse; mocked: boolean; model: string | null };
    slugToCategoryId: Map<string, string>;
  },
): Promise<PersistResult> {
  const { tripId, versionNumber, result, slugToCategoryId } = params;

  const { data: version, error: versionErr } = await admin
    .from('itinerary_versions')
    .insert({
      trip_id: tripId,
      version_number: versionNumber,
      rationale: result.data.destination_reason,
      raw_response: result.data,
      model: result.mocked ? 'mock' : result.model,
      is_current: true,
    })
    .select('id')
    .single();

  if (versionErr || !version) {
    console.error('[persist-itinerary] insert de version falló:', versionErr);
    return { ok: false, error: 'No se pudo guardar el itinerario.' };
  }

  const activityRows = result.data.activities.map((a) => ({
    version_id: version.id,
    day_number: a.day_number,
    position: a.position,
    title: a.title,
    description: a.description,
    category_id: slugToCategoryId.get(a.category_slug) ?? null,
    start_time: a.start_time === '' ? null : a.start_time,
    duration_min: a.duration_min,
    estimated_cost: a.estimated_cost,
    place_name: a.place_name,
    address: a.address === '' ? null : a.address,
    lat: a.lat,
    lon: a.lon,
  }));

  const { error: actErr } = await admin.from('itinerary_activities').insert(activityRows);

  if (actErr) {
    // Sin transacciones desde el cliente JS: si las actividades fallan, la
    // versión se queda huérfana ocupando el hueco de version_number para
    // siempre. El cascade de version_id limpia lo que hubiera entrado.
    await admin.from('itinerary_versions').delete().eq('id', version.id);
    console.error('[persist-itinerary] insert de actividades falló:', actErr);
    return { ok: false, error: 'No se pudieron guardar las actividades del itinerario.' };
  }

  return { ok: true, versionId: version.id };
}
