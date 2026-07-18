import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ConflictsPanel } from '@/components/itinerary/conflicts-panel';
import { MockBadge } from '@/components/itinerary/mock-badge';
import { FinalizeButton } from '@/components/vote/finalize-button';
import { RegenerateButton } from '@/components/vote/regenerate-button';
import { VoteButtons } from '@/components/vote/vote-buttons';
import { createClient } from '@/lib/supabase/server';
import { TRIP_STATUS } from '@/lib/trip-labels';
import { MAX_REGENERATIONS, type VoteValue } from '@/lib/types/database';
import {
  activityMeetsQuorum,
  quorumThreshold,
  tallyVotes,
  votesCast,
} from '@/lib/votes';

type ActivityRow = {
  id: string;
  day_number: number;
  position: number;
  title: string;
  description: string | null;
  start_time: string | null;
  estimated_cost: number | null;
  place_name: string | null;
  category: { slug: string; label: string; emoji: string | null } | null;
};

export default async function VotePage({
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
    .select('id, title, status, organizer_id, regenerations_used')
    .eq('id', tripId)
    .single();

  // RLS: si no eres participante, no lo ves → 404, igual que el resto de la app.
  if (!trip) notFound();

  const isOrganizer = trip.organizer_id === user.id;

  const { data: version } = await supabase
    .from('itinerary_versions')
    .select('id, version_number, rationale, raw_response, model')
    .eq('trip_id', tripId)
    .eq('is_current', true)
    .single();

  if (!version) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-6">
        <Link href={`/trips/${tripId}`} className="link-back">
          ← {trip.title}
        </Link>
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Todavía no hay ningún itinerario generado para este viaje.
        </div>
      </main>
    );
  }

  const [{ data: activitiesData }, { data: participantRows }] = await Promise.all([
    supabase
      .from('itinerary_activities')
      .select(
        'id, day_number, position, title, description, start_time, estimated_cost, place_name, category:categories(slug, label, emoji)',
      )
      .eq('version_id', version.id)
      .order('day_number', { ascending: true })
      .order('position', { ascending: true }),
    supabase.from('trip_participants').select('user_id').eq('trip_id', tripId),
  ]);

  const activities = (activitiesData ?? []) as unknown as ActivityRow[];
  const activityIds = activities.map((a) => a.id);
  const currentParticipantIds = new Set((participantRows ?? []).map((p) => p.user_id));

  const { data: votesData } =
    activityIds.length > 0
      ? await supabase.from('votes').select('activity_id, user_id, value').in('activity_id', activityIds)
      : { data: [] };
  const allVotes = (votesData ?? []) as { activity_id: string; user_id: string | null; value: VoteValue }[];
  // Los votos de quien ya salió del viaje no cuentan: antes inflaban tanto el
  // quórum como el "X/Y han votado" (podía mostrar un imposible "3/1").
  const votes = allVotes.filter((v) => v.user_id != null && currentParticipantIds.has(v.user_id));

  const total = currentParticipantIds.size;
  const threshold = quorumThreshold(total);
  const tallies = tallyVotes(votes);
  const myVoteByActivity = new Map(
    votes.filter((v) => v.user_id === user.id).map((v) => [v.activity_id, v.value]),
  );

  const missingQuorum = activities.filter(
    (a) => !activityMeetsQuorum(tallies.get(a.id), threshold),
  );
  const quorumMet = missingQuorum.length === 0;

  const days = new Map<number, ActivityRow[]>();
  for (const a of activities) {
    const list = days.get(a.day_number) ?? [];
    list.push(a);
    days.set(a.day_number, list);
  }

  const status = TRIP_STATUS[trip.status];
  // La ficha del viaje enlaza aquí tanto en 'voting' como en 'finalized'. Con
  // el viaje ya cerrado la votación no acepta cambios (el trigger la rechaza),
  // así que en vez de mostrar botones que parecen clicables pero siempre
  // fallan, se enseña el voto de cada uno en modo solo lectura.
  const votingOpen = trip.status === 'voting';
  const VOTE_LABEL: Record<VoteValue, string> = {
    for: 'A favor',
    abstain: 'Abstención',
    against: 'En contra',
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-6">
      <Link href={`/trips/${tripId}`} className="link-back">
        ← {trip.title}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Votación del itinerario</h1>
          <span className={`badge ${status.className}`}>{status.label}</span>
          {version.model === 'mock' && <MockBadge />}
        </div>
        <p className="text-sm text-neutral-500">
          Versión {version.version_number} de {1 + MAX_REGENERATIONS} · vota cada actividad, a favor,
          en contra o en abstención. Puedes cambiar tu voto cuando quieras mientras la ronda siga abierta.
        </p>
      </header>

      {votingOpen ? (
        <div className="alert-info rounded-xl p-4">
          {quorumMet ? (
            <span>
              Quorum alcanzado: todas las actividades tienen votos de al menos {threshold} de {total}{' '}
              participantes.
            </span>
          ) : (
            <span>
              Faltan votos suficientes en {missingQuorum.length} de {activities.length} actividades
              (se necesita al menos {threshold} de {total} participantes por actividad).
            </span>
          )}
        </div>
      ) : (
        <div className="alert-neutral rounded-xl p-4">
          La votación está cerrada. Este es el resultado final del itinerario.
        </div>
      )}

      <ConflictsPanel raw={version.raw_response} />

      <section className="space-y-6">
        {[...days.entries()].map(([day, dayActivities]) => (
          <div key={day} className="space-y-2">
            <h2 className="text-sm font-medium text-neutral-500">Día {day}</h2>
            <ul className="card divide-y divide-neutral-200 dark:divide-neutral-800">
              {dayActivities.map((a) => {
                const tally = tallies.get(a.id);
                const cast = votesCast(tally);
                return (
                  <li key={a.id} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {a.category?.emoji} {a.title}
                        </p>
                        {a.place_name && (
                          <p className="text-xs text-neutral-400">{a.place_name}</p>
                        )}
                        {a.description && (
                          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                            {a.description}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-neutral-400">
                          {a.start_time?.slice(0, 5)}
                          {a.estimated_cost != null ? ` · ${a.estimated_cost} €/persona` : ''} ·{' '}
                          {cast}/{total} han votado
                        </p>
                      </div>
                      {votingOpen ? (
                        <VoteButtons
                          tripId={tripId}
                          activityId={a.id}
                          initialValue={myVoteByActivity.get(a.id) ?? null}
                        />
                      ) : (
                        <span className="shrink-0 self-start text-xs text-neutral-400">
                          Tu voto:{' '}
                          {myVoteByActivity.has(a.id)
                            ? VOTE_LABEL[myVoteByActivity.get(a.id)!]
                            : 'no votaste'}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {isOrganizer && trip.status === 'voting' && (
        <section className="card flex flex-col gap-3 p-4">
          <h2 className="text-sm font-medium text-neutral-500">Controles del organizador</h2>
          <RegenerateButton
            tripId={tripId}
            quorumMet={quorumMet}
            regenerationsUsed={trip.regenerations_used}
            maxRegenerations={MAX_REGENERATIONS}
            reasonWhenBlocked={`Faltan votos suficientes en ${missingQuorum.length} actividad(es).`}
          />
          <FinalizeButton tripId={tripId} />
        </section>
      )}
    </main>
  );
}
