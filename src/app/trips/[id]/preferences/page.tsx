import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { PreferencesForm } from '@/components/preferences/preferences-form';
import { createClient } from '@/lib/supabase/server';
import type { CategoryStance } from '@/lib/types/database';

export default async function PreferencesPage({
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
    .select('id, title, budget_mode')
    .eq('id', tripId)
    .single();

  // RLS: si no eres participante de este viaje, no lo ves → 404. No hay forma
  // de "colarse" a rellenar preferencias de un viaje ajeno desde la UI.
  if (!trip) notFound();

  // Asegura que exista el borrador antes de pintar el form: así toda la lógica
  // de guardado de abajo es siempre "actualizar fila existente", sin ramas de
  // "crear vs actualizar". ignoreDuplicates: no toca nada si ya existe.
  await supabase
    .from('preferences')
    .upsert(
      { trip_id: tripId, user_id: user.id },
      { onConflict: 'trip_id,user_id', ignoreDuplicates: true },
    );

  const [{ data: categories }, { data: preference }] = await Promise.all([
    supabase.from('categories').select('id, slug, label, emoji').order('sort_order'),
    supabase
      .from('preferences')
      .select('id, budget_amount, vetoes, submitted_at')
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .single(),
  ]);

  const { data: preferenceCategories } = preference
    ? await supabase
        .from('preference_categories')
        .select('category_id, stance')
        .eq('preference_id', preference.id)
    : { data: [] };

  const initialStances: Record<string, CategoryStance> = {};
  for (const pc of preferenceCategories ?? []) {
    initialStances[pc.category_id] = pc.stance;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-6">
      <Link href={`/trips/${tripId}`} className="link-back">
        ← {trip.title}
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tus preferencias</h1>
        <p className="text-sm text-neutral-500">
          Se guardan solas mientras las rellenas. Confírmalas cuando estén listas.
        </p>
      </header>

      <PreferencesForm
        tripId={tripId}
        budgetMode={trip.budget_mode}
        categories={categories ?? []}
        initialBudget={preference?.budget_amount ?? null}
        initialVetoes={preference?.vetoes ?? ''}
        initialStances={initialStances}
        initialSubmittedAt={preference?.submitted_at ?? null}
      />
    </main>
  );
}
