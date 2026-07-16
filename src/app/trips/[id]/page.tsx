import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { InviteCode } from '@/components/trips/invite-code';
import { TripMembership } from '@/components/trips/trip-membership';
import { createClient } from '@/lib/supabase/server';
import { TRIP_STATUS, BUDGET_MODE } from '@/lib/trip-labels';
import type { ParticipantRole } from '@/lib/types/database';

type ParticipantRow = {
  user_id: string;
  role: ParticipantRole;
  profile: { display_name: string | null; email: string } | null;
};

function nameOf(p: ParticipantRow['profile']): string {
  return p?.display_name ?? p?.email?.split('@')[0] ?? 'Alguien';
}

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
    .select('id, title, status, budget_mode, group_budget, days, invite_code, organizer_id')
    .eq('id', id)
    .single();

  // RLS: si no eres participante, no lo ves → 404.
  if (!trip) notFound();

  const { data: participantsData } = await supabase
    .from('trip_participants')
    .select('user_id, role, profile:profiles(display_name, email)')
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
      <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
        ← Mis viajes
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{trip.title}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>
        <p className="text-sm text-neutral-500">
          {trip.days} {trip.days === 1 ? 'día' : 'días'} · {BUDGET_MODE[trip.budget_mode]}
          {trip.budget_mode === 'group' && trip.group_budget != null
            ? ` · ${trip.group_budget} €`
            : ''}
        </p>
      </header>

      <InviteCode code={trip.invite_code} />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-500">
          Participantes ({participants.length})
        </h2>
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {participants.map((p) => (
            <li key={p.user_id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                {nameOf(p.profile)}
                {p.user_id === user.id && (
                  <span className="ml-1 text-neutral-400">(tú)</span>
                )}
              </span>
              {p.role === 'organizer' && (
                <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white dark:bg-white dark:text-neutral-900">
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
