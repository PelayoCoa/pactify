import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { DestinationSearch } from '@/components/destinations/destination-search';
import { RemoveProposalButton } from '@/components/destinations/remove-proposal-button';
import { Avatar } from '@/components/profile/avatar';
import { nameOf, type ProfileLite } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

type ProposalRow = {
  id: string;
  name: string;
  country: string | null;
  notes: string | null;
  user_id: string | null;
  profile: ProfileLite;
};

export default async function DestinationsPage({
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
    .select('id, title')
    .eq('id', tripId)
    .single();

  // RLS: si no eres participante, no lo ves → 404.
  if (!trip) notFound();

  const { data: proposalsData } = await supabase
    .from('destination_proposals')
    .select('id, name, country, notes, user_id, profile:profiles(display_name, email, avatar_url)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  const proposals = (proposalsData ?? []) as unknown as ProposalRow[];

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-6">
      <Link href={`/trips/${tripId}`} className="link-back">
        ← {trip.title}
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Destinos propuestos</h1>
        <p className="text-sm text-neutral-500">
          Museos, playas, restaurantes… lo que os apetezca visitar.
        </p>
      </header>

      <DestinationSearch tripId={tripId} />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-500">
          Propuestas del grupo ({proposals.length})
        </h2>

        {proposals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            Nadie ha propuesto nada todavía.
          </div>
        ) : (
          <ul className="card divide-y divide-neutral-200 dark:divide-neutral-800">
            {proposals.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="flex items-start gap-2">
                  <Avatar name={nameOf(p.profile)} avatarUrl={p.profile?.avatar_url} size="sm" />
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.country && <p className="text-xs text-neutral-400">{p.country}</p>}
                    {p.notes && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{p.notes}</p>}
                    <p className="mt-1 text-xs text-neutral-400">
                      Propuesto por {p.user_id === user.id ? 'ti' : nameOf(p.profile)}
                    </p>
                  </div>
                </div>
                {p.user_id === user.id && (
                  <RemoveProposalButton tripId={tripId} proposalId={p.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
