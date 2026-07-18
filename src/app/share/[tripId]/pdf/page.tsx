import { notFound } from 'next/navigation';

import type { ItineraryActivityView } from '@/components/itinerary/itinerary-map-view';
import { ItineraryPrintDocument } from '@/components/itinerary/itinerary-print-document';
import { PrintButton } from '@/components/itinerary/print-button';
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

/** Versión en PDF de /share/[tripId] — mismo guardián: solo viajes finalized. */
export default async function PublicItineraryPdfPage({
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

  // Ojo: NO se selecciona raw_response aquí -es donde viven los conflictos,
  // y esos citan nombres e importes reales de los participantes (ver el
  // comentario en ItineraryPrintDocument). Esta ruta es pública y sin login;
  // no debe poder filtrar eso ni por accidente.
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

  const { data: votesData } =
    activityIds.length > 0
      ? await admin.from('votes').select('activity_id, value').in('activity_id', activityIds)
      : { data: [] };
  const tallies = tallyVotes(votesData ?? []);

  const activities: ItineraryActivityView[] = activityRows
    .map((a) => ({
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
    }))
    .filter((a) => !a.rejected);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6 print:max-w-none print:p-0">
      <PrintButton />
      <ItineraryPrintDocument
        tripTitle={trip.title}
        destination={trip.destination}
        activities={activities}
        isMock={version.model === 'mock'}
      />
    </main>
  );
}
