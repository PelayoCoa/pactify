import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Avatar } from '@/components/profile/avatar';
import { JoinTripForm } from '@/components/trips/join-trip-form';
import { SearchParamToast } from '@/components/ui/search-param-toast';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { createClient } from '@/lib/supabase/server';
import { TRIP_STATUS, BUDGET_MODE } from '@/lib/trip-labels';
import type { BudgetMode, ParticipantRole, TripStatus } from '@/lib/types/database';

/** Forma de cada fila que devuelve la query (embeds no tipados a mano). */
type TripRow = {
  role: ParticipantRole;
  trip: {
    id: string;
    title: string;
    status: TripStatus;
    budget_mode: BudgetMode;
    photo_url: string | null;
    participants: { count: number }[];
  } | null;
};

type TripCard = {
  id: string;
  title: string;
  status: TripStatus;
  budgetMode: BudgetMode;
  photoUrl: string | null;
  participantCount: number;
};

function TripCardLink({ trip }: { trip: TripCard }) {
  const status = TRIP_STATUS[trip.status];
  return (
    <li>
      <Link
        href={`/trips/${trip.id}`}
        className={`card group flex items-start gap-3 border-l-4 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${status.accentClass}`}
      >
        <Avatar name={trip.title} avatarUrl={trip.photoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium">{trip.title}</p>
            <span className={`badge shrink-0 ${status.className}`}>{status.label}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {trip.participantCount} {trip.participantCount === 1 ? 'participante' : 'participantes'} ·{' '}
            {BUDGET_MODE[trip.budgetMode]}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, avatar_url')
    .eq('id', user.id)
    .single();

  const myName = profile?.display_name ?? profile?.email?.split('@')[0] ?? 'Tú';

  const { data } = await supabase
    .from('trip_participants')
    .select(
      'role, trip:trips(id, title, status, budget_mode, photo_url, participants:trip_participants(count))',
    )
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  const rows = (data ?? []) as unknown as TripRow[];

  const cards: (TripCard & { role: ParticipantRole })[] = rows
    .filter((r) => r.trip !== null)
    .map((r) => ({
      id: r.trip!.id,
      title: r.trip!.title,
      status: r.trip!.status,
      budgetMode: r.trip!.budget_mode,
      photoUrl: r.trip!.photo_url,
      participantCount: r.trip!.participants?.[0]?.count ?? 0,
      role: r.role,
    }));

  // Separación clara para leerse de un vistazo: lo que organizas primero
  // -eres responsable de moverlo hacia adelante-, luego en lo que participas.
  const organized = cards.filter((c) => c.role === 'organizer');
  const participating = cards.filter((c) => c.role !== 'organizer');

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 p-6 sm:p-10 lg:max-w-5xl lg:p-12 2xl:max-w-6xl">
      <Suspense fallback={null}>
        <SearchParamToast
          param="left"
          matchers={[
            { value: 'deleted', message: 'Saliste y, como no quedaba nadie, el viaje se borró.', variant: 'info' },
            { value: '1', message: 'Has salido del viaje.', variant: 'info' },
          ]}
        />
      </Suspense>

      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mis viajes</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {cards.length === 0
              ? 'Todavía no estás en ningún viaje.'
              : `${cards.length} ${cards.length === 1 ? 'viaje en marcha' : 'viajes en marcha'}.`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/profile" className="link-back flex items-center gap-2">
            <Avatar name={myName} avatarUrl={profile?.avatar_url} size="sm" />
            Perfil
          </Link>
          <Link href="/trips/new" className="btn-primary">
            + Nuevo viaje
          </Link>
        </div>
      </header>

      <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">¿Te han invitado a un viaje?</h2>
          <p className="text-xs text-neutral-500">Pega el código que te han pasado para unirte.</p>
        </div>
        <div className="sm:w-72">
          <JoinTripForm />
        </div>
      </section>

      {cards.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-semibold"
            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            +
          </span>
          <p className="font-medium">Crea tu primer viaje</p>
          <p className="max-w-sm text-sm text-neutral-500">
            Organiza un viaje, invita a tu grupo con un código y dejad que Pactify reparta
            preferencias y arme el itinerario.
          </p>
          <Link href="/trips/new" className="btn-primary mt-2">
            + Nuevo viaje
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Organizas
              </h2>
              <span className="text-xs text-neutral-400">({organized.length})</span>
            </div>
            {organized.length === 0 ? (
              <p className="text-sm text-neutral-400">
                No organizas ningún viaje todavía.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {organized.map((t) => (
                  <TripCardLink key={t.id} trip={t} />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Participas
              </h2>
              <span className="text-xs text-neutral-400">({participating.length})</span>
            </div>
            {participating.length === 0 ? (
              <p className="text-sm text-neutral-400">
                No participas en ningún otro viaje.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {participating.map((t) => (
                  <TripCardLink key={t.id} trip={t} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
