import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Avatar } from '@/components/profile/avatar';
import { GenerateItineraryButton } from '@/components/trips/generate-itinerary-button';
import { InviteCode } from '@/components/trips/invite-code';
import { TripMembership } from '@/components/trips/trip-membership';
import { TripPhoto } from '@/components/trips/trip-photo';
import { SearchParamToast } from '@/components/ui/search-param-toast';
import { nameOf, type ProfileLite } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { TRIP_STATUS, BUDGET_MODE } from '@/lib/trip-labels';
import type { ParticipantRole } from '@/lib/types/database';

type ParticipantRow = {
  user_id: string;
  role: ParticipantRole;
  profile: ProfileLite;
};

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: trip } = await supabase
    .from('trips')
    .select('id, title, status, budget_mode, group_budget, days, invite_code, organizer_id, photo_url')
    .eq('id', id)
    .single();

  // RLS: si no eres participante, no lo ves → 404.
  if (!trip) notFound();

  const { data: participantsData } = await supabase
    .from('trip_participants')
    .select('user_id, role, profile:profiles(display_name, email, avatar_url)')
    .eq('trip_id', id)
    .order('joined_at', { ascending: true });

  const participants = (participantsData ?? []) as unknown as ParticipantRow[];

  const isOrganizer = trip.organizer_id === user.id;
  const otherMembers = participants
    .filter((p) => p.user_id !== user.id)
    .map((p) => ({ user_id: p.user_id, name: nameOf(p.profile) }));

  const status = TRIP_STATUS[trip.status];

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-6">
      <Suspense fallback={null}>
        <SearchParamToast
          param="joined"
          matchers={[{ value: '1', message: 'Te uniste al viaje.', variant: 'success' }]}
        />
      </Suspense>

      <Link href="/dashboard" className="link-back">
        ← Mis viajes
      </Link>

      <header className="space-y-3">
        <TripPhoto tripId={trip.id} tripTitle={trip.title} initialPhotoUrl={trip.photo_url} />
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{trip.title}</h1>
          <span className={`badge ${status.className}`}>{status.label}</span>
        </div>
        <p className="text-sm text-neutral-500">
          {trip.days} {trip.days === 1 ? 'día' : 'días'} · {BUDGET_MODE[trip.budget_mode]}
          {trip.budget_mode === 'group' && trip.group_budget != null
            ? ` · ${trip.group_budget} €`
            : ''}
        </p>
      </header>

      <InviteCode code={trip.invite_code} />

      {isOrganizer && (trip.status === 'draft' || trip.status === 'collecting') && (
        <div className="card flex flex-col gap-2 p-4">
          <h2 className="text-sm font-medium">Generar el itinerario</h2>
          <p className="text-xs text-neutral-500">
            Cuando todo el grupo haya confirmado sus preferencias, genera la primera propuesta con IA.
          </p>
          <GenerateItineraryButton tripId={trip.id} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/trips/${trip.id}/preferences`}
          className="rounded-xl border border-neutral-200 p-4 text-center text-sm font-medium hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          Mis preferencias
        </Link>
        <Link
          href={`/trips/${trip.id}/destinations`}
          className="rounded-xl border border-neutral-200 p-4 text-center text-sm font-medium hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          Destinos propuestos
        </Link>
        {(trip.status === 'voting' || trip.status === 'finalized') && (
          <>
            <Link
              href={`/trips/${trip.id}/itinerary`}
              className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-center text-sm font-medium text-teal-900 hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-200 dark:hover:bg-teal-950/50"
            >
              Ver itinerario y mapa
            </Link>
            <Link
              href={`/trips/${trip.id}/vote`}
              className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-center text-sm font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200 dark:hover:bg-violet-950/50"
            >
              Votar el itinerario
            </Link>
          </>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-500">
          Participantes ({participants.length})
        </h2>
        <ul className="card divide-y divide-neutral-200 dark:divide-neutral-800">
          {participants.map((p) => (
            <li key={p.user_id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="flex items-center gap-2">
                <Avatar name={nameOf(p.profile)} avatarUrl={p.profile?.avatar_url} size="sm" />
                <span>
                  {nameOf(p.profile)}
                  {p.user_id === user.id && (
                    <span className="ml-1 text-neutral-400">(tú)</span>
                  )}
                </span>
              </span>
              {p.role === 'organizer' && (
                <span className="badge bg-neutral-900 text-[11px] uppercase tracking-wide text-white dark:bg-white dark:text-neutral-900">
                  Organizador
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <TripMembership
        tripId={trip.id}
        isOrganizer={isOrganizer}
        otherMembers={otherMembers}
      />
    </main>
  );
}
