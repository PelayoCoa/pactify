import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ParticipantContext,
  ProposalContext,
  TripContext,
} from '@/lib/ai/prompt';
import { nameOf, type ProfileLite } from '@/lib/profile';
import type {
  BudgetMode,
  CategoryStance,
  Database,
} from '@/lib/types/database';

export type { ProfileLite };
export { nameOf };

type PreferenceRow = {
  user_id: string;
  budget_amount: number | null;
  vetoes: string | null;
  submitted_at: string | null;
  profile: ProfileLite;
  categories: { stance: CategoryStance; category: { slug: string } | null }[];
};

type ProposalRow = {
  name: string;
  country: string | null;
  notes: string | null;
  lat: number | null;
  lon: number | null;
  profile: ProfileLite;
};

export type BaseTripAiContext = {
  /** TripContext sin el campo `regeneration` — /generate lo usa tal cual,
   *  /regenerate le añade `regeneration` encima. */
  ctx: TripContext;
  slugToCategoryId: Map<string, string>;
  /** Nombres de quien falta por confirmar preferencias. Vacío = todos listos. */
  pendingNames: string[];
};

/**
 * Recoge categorías, preferencias confirmadas, propuestas y participantes de
 * un viaje, y arma el TripContext base para el prompt.
 *
 * Compartido entre /generate y /regenerate: los dos necesitan exactamente los
 * mismos datos de partida (preferencias + propuestas no cambian entre
 * rondas), solo /regenerate añade encima el resultado de la votación.
 */
export async function loadBaseTripAiContext(
  supabase: SupabaseClient<Database>,
  tripId: string,
  trip: { title: string; days: number; budget_mode: BudgetMode; group_budget: number | null },
): Promise<BaseTripAiContext> {
  const [{ data: categoriesData }, { data: prefsData }, { data: proposalsData }] =
    await Promise.all([
      supabase.from('categories').select('id, slug, label').order('sort_order'),
      supabase
        .from('preferences')
        .select(
          'user_id, budget_amount, vetoes, submitted_at, profile:profiles(display_name, email), categories:preference_categories(stance, category:categories(slug))',
        )
        .eq('trip_id', tripId),
      supabase
        .from('destination_proposals')
        .select('name, country, notes, lat, lon, profile:profiles(display_name, email)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true }),
    ]);

  const categories = categoriesData ?? [];
  const prefs = (prefsData ?? []) as unknown as PreferenceRow[];
  const proposals = (proposalsData ?? []) as unknown as ProposalRow[];

  const { data: participantsData } = await supabase
    .from('trip_participants')
    .select('user_id, profile:profiles(display_name, email)')
    .eq('trip_id', tripId);

  const participants = (participantsData ?? []) as unknown as {
    user_id: string;
    profile: ProfileLite;
  }[];

  const submitted = new Set(
    prefs.filter((p) => p.submitted_at !== null).map((p) => p.user_id),
  );
  const pendingNames = participants
    .filter((p) => !submitted.has(p.user_id))
    .map((p) => nameOf(p.profile));

  const slugToCategoryId = new Map(categories.map((c) => [c.slug, c.id]));

  const participantCtx: ParticipantContext[] = prefs.map((p) => ({
    name: nameOf(p.profile),
    budgetAmount: p.budget_amount,
    vetoes: p.vetoes,
    favorites: p.categories
      .filter((c) => c.stance === 'favorite' && c.category)
      .map((c) => c.category!.slug),
    hated: p.categories
      .filter((c) => c.stance === 'hated' && c.category)
      .map((c) => c.category!.slug),
  }));

  const proposalCtx: ProposalContext[] = proposals.map((d) => ({
    name: d.name,
    country: d.country,
    notes: d.notes,
    proposedBy: nameOf(d.profile),
    lat: d.lat,
    lon: d.lon,
  }));

  const ctx: TripContext = {
    title: trip.title,
    days: trip.days,
    budgetMode: trip.budget_mode,
    groupBudget: trip.group_budget,
    categories: categories.map((c) => ({ slug: c.slug, label: c.label })),
    participants: participantCtx,
    proposals: proposalCtx,
  };

  return { ctx, slugToCategoryId, pendingNames };
}
