import Link from 'next/link';
import { redirect } from 'next/navigation';

import { JoinTripForm } from '@/components/trips/join-trip-form';
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
    participants: { count: number }[];
  } | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ left?: string }>;
}) {
  const { left } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('trip_participants')
    .select(
      'role, trip:trips(id, title, status, budget_mode, participants:trip_participants(count))',
    )
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  const rows = (data ?? []) as unknown as TripRow[];
  const trips = rows.filter((r) => r.trip !== null);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mis viajes</h1>
        <nav className="flex items-center gap-4 text-sm text-neutral-500">
          <Link href="/profile" className="hover:underline">
            Perfil
          </Link>
          <Link
            href="/trips/new"
            className="rounded-lg bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-700"
          >
            + Nuevo viaje
          </Link>
        </nav>
      </header>

      {left && (
        <p className="rounded-lg bg-neutral-100 p-3 text-sm text-neutral-600 dark:bg-neutral-900">
          {left === 'deleted'
            ? 'Saliste y, como no quedaba nadie, el viaje se borró.'
            : 'Has salido del viaje.'}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-500">Unirme a un viaje</h2>
        <JoinTripForm />
      </section>

      <section className="space-y-3">
        {trips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            Aún no estás en ningún viaje. Crea uno o únete con un código.
          </div>
        ) : (
          <ul className="space-y-3">
            {trips.map(({ role, trip }) => {
              const t = trip!;
              const status = TRIP_STATUS[t.status];
              const count = t.participants?.[0]?.count ?? 0;
              const isOrganizer = role === 'organizer';
              return (
                <li key={t.id}>
                  <Link
                    href={`/trips/${t.id}`}
                    className={`block rounded-xl border-l-4 border border-neutral-200 p-4 transition hover:shadow-sm dark:border-neutral-800 ${
                      isOrganizer ? 'border-l-neutral-900 dark:border-l-white' : 'border-l-neutral-300 dark:border-l-neutral-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{t.title}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {count} {count === 1 ? 'participante' : 'participantes'} ·{' '}
                          {BUDGET_MODE[t.budget_mode]}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <span
                      className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                        isOrganizer
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}
                    >
                      {isOrganizer ? 'Organizas' : 'Participas'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
