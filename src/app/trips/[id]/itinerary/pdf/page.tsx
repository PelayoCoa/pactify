import { notFound, redirect } from 'next/navigation';

import type { ItineraryActivityView } from '@/components/itinerary/itinerary-map-view';
import { ItineraryPrintDocument } from '@/components/itinerary/itinerary-print-document';
import { PrintButton } from '@/components/itinerary/print-button';
import { extractConflicts } from '@/lib/ai/itinerary-schema';
import { createClient } from '@/lib/supabase/server';
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

export default async function ItineraryPdfPage({
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
    .select('id, title, status, destination')
    .eq('id', tripId)
    .single();

  // RLS: si no eres participante, no lo ves → 404, igual que el resto de la app.
  if (!trip) notFound();

  const { data: version } = await supabase
    .from('itinerary_versions')
    .select('id, version_number, raw_response, model')
    .eq('trip_id', tripId)
    .eq('is_current', true)
    .single();

  if (!version) notFound();

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

  const { data: votesData } =
    activityIds.length > 0
      ? await supabase.from('votes').select('activity_id, value').in('activity_id', activityIds)
      : { data: [] };
  const tallies = tallyVotes(votesData ?? []);

  const allActivities: ItineraryActivityView[] = activityRows.map((a) => ({
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

  // Mismo criterio que la vista interactiva: finalizado esconde las
  // rechazadas; en votación se exporta el estado actual tal cual, con todo.
  const activities =
    trip.status === 'finalized' ? allActivities.filter((a) => !a.rejected) : allActivities;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6 print:max-w-none print:p-0">
      <PrintButton />
      <ItineraryPrintDocument
        tripTitle={trip.title}
        destination={trip.destination}
        activities={activities}
        conflicts={extractConflicts(version.raw_response)}
        isMock={version.model === 'mock'}
      />
    </main>
  );
}
