import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ConflictsPanel } from '@/components/itinerary/conflicts-panel';
import { ItineraryMapView, type ItineraryActivityView } from '@/components/itinerary/itinerary-map-view';
import { MockBadge } from '@/components/itinerary/mock-badge';
import { ShareItineraryLink } from '@/components/trips/share-itinerary-link';
import { getSiteUrl } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';
import { TRIP_STATUS } from '@/lib/trip-labels';
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

export default async function ItineraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tripId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: trip } = await supabase
    .from('trips')
    .select('id, title, status, destination, organizer_id')
    .eq('id', tripId)
    .single();

  // RLS: si no eres participante, no lo ves → 404, igual que el resto de la app.
  if (!trip) notFound();

  const isOrganizer = trip.organizer_id === user.id;

  const { data: version } = await supabase
    .from('itinerary_versions')
    .select('id, version_number, raw_response, model')
    .eq('trip_id', tripId)
    .eq('is_current', true)
    .single();

  if (!version) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
        <Link href={`/trips/${tripId}`} className="link-back">
          ← {trip.title}
        </Link>
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Todavía no hay ningún itinerario generado para este viaje.
        </div>
      </main>
    );
  }

  const { data: activitiesData } = await supabase
    .from('itinerary_activities')
    .select(
      'id, day_number, position, title, description, start_time, estimated_cost, place_name, lat, lon, category:categories(slug, label, emoji)',
    )
    .eq('version_id', version.id)
    .order('day_number', { ascending: true })
    .order('position', { ascending: true });

  const activityRows = (activitiesData ?? []) as unknown as ActivityRow[];
  const activityIds = activityRows.map((a) => a.id);

  // Recuento de votos por actividad: decide qué se ve mal (en votación) o qué
  // se oculta directamente (ya finalizado). No toca la lógica de regeneración,
  // es puro cálculo de visualización a partir de los mismos votos.
  const { data: votesData } =
    activityIds.length > 0
      ? await supabase.from('votes').select('activity_id, value').in('activity_id', activityIds)
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

  const status = TRIP_STATUS[trip.status];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <Link href={`/trips/${tripId}`} className="link-back">
        ← {trip.title}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Itinerario</h1>
          <span className={`badge ${status.className}`}>{status.label}</span>
          {version.model === 'mock' && <MockBadge />}
        </div>
        <p className="text-sm text-neutral-500">
          {trip.destination ? `${trip.destination} · ` : ''}versión {version.version_number}
        </p>
        <Link href={`/trips/${tripId}/itinerary/pdf`} target="_blank" className="btn-secondary inline-flex w-fit">
          Descargar PDF
        </Link>
      </header>

      <ConflictsPanel raw={version.raw_response} />

      <ItineraryMapView activities={activities} finalized={trip.status === 'finalized'} />

      {isOrganizer && trip.status === 'finalized' && (
        <ShareItineraryLink url={`${getSiteUrl()}/share/${trip.id}`} />
      )}
    </main>
  );
}
