import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ItineraryMapView, type ItineraryActivityView } from '@/components/itinerary/itinerary-map-view';
import { MockBadge } from '@/components/itinerary/mock-badge';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRejected, tallyVotes } from '@/lib/votes';

type ActivityRow = {
  id: string;
  day_number: number;
  position: number;
  title: string;
  description: string | null;
  start_time: string | null;
  estimated_cost: number | null;
  place_name: string | null;
  lat: number | null;
  lon: number | null;
  category: { slug: string; label: string; emoji: string | null } | null;
};

/**
 * Vista pública de solo lectura, sin sesión: para poder enseñar el itinerario
 * final en el vídeo de la demo sin tener que iniciar sesión en directo.
 *
 * Usa el cliente admin a propósito -no hay usuario, así que RLS no aplicaría-,
 * pero el propio código hace de guardián en su lugar: SOLO responde para
 * viajes `finalized`. Cualquier otro estado (draft/collecting/generating/
 * voting) da el mismo 404 que un viaje inexistente -no se distingue entre
 * "no existe" y "existe pero no toca todavía"-, para no filtrar ni que un
 * itinerario a medio votar, ni las preferencias de nadie, se puedan ver sin
 * cuenta. La URL es el UUID del viaje -no listable, mismo criterio de riesgo
 * ya aceptado con los buckets públicos de avatars/trip-photos-.
 */
export default async function PublicItineraryPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const admin = createAdminClient();

  const { data: trip } = await admin
    .from('trips')
    .select('id, title, status, destination')
    .eq('id', tripId)
    .single();

  if (!trip || trip.status !== 'finalized') notFound();

  const { data: version } = await admin
    .from('itinerary_versions')
    .select('id, version_number, model')
    .eq('trip_id', tripId)
    .eq('is_current', true)
    .single();

  if (!version) notFound();

  const { data: activitiesData } = await admin
    .from('itinerary_activities')
    .select(
      'id, day_number, position, title, description, start_time, estimated_cost, place_name, lat, lon, category:categories(slug, label, emoji)',
    )
    .eq('version_id', version.id)
    .order('day_number', { ascending: true })
    .order('position', { ascending: true });

  const activityRows = (activitiesData ?? []) as unknown as ActivityRow[];
  const activityIds = activityRows.map((a) => a.id);

  // Los votos solo se leen para calcular qué quedó rechazado -el mismo
  // cálculo que la vista interna-, nunca se exponen recuentos en esta pantalla.
  const { data: votesData } =
    activityIds.length > 0
      ? await admin.from('votes').select('activity_id, value').in('activity_id', activityIds)
      : { data: [] };
  const tallies = tallyVotes(votesData ?? []);

  const activities: ItineraryActivityView[] = activityRows.map((a) => ({
    id: a.id,
    dayNumber: a.day_number,
    position: a.position,
    title: a.title,
    description: a.description,
    placeName: a.place_name,
    startTime: a.start_time,
    estimatedCost: a.estimated_cost,
    categoryEmoji: a.category?.emoji ?? null,
    categoryLabel: a.category?.label ?? null,
    lat: a.lat,
    lon: a.lon,
    rejected: isRejected(tallies.get(a.id)),
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{trip.title}</h1>
          {version.model === 'mock' && <MockBadge />}
        </div>
        <p className="text-sm text-neutral-500">
          {trip.destination ? `${trip.destination} · ` : ''}itinerario final
        </p>
        <Link href={`/share/${tripId}/pdf`} target="_blank" className="btn-secondary inline-flex w-fit">
          Descargar PDF
        </Link>
      </header>

      <ItineraryMapView activities={activities} finalized />

      <p className="pt-2 text-center text-xs text-neutral-400">
        Compartido desde{' '}
        <Link href="/" className="hover:underline">
          Pactify
        </Link>
        .
      </p>
    </main>
  );
}
