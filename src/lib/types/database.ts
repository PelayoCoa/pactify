/**
 * Tipos de la base de datos.
 *
 * Escritos a mano para que el proyecto compile desde el minuto cero. En cuanto
 * el esquema esté en Supabase, regenéralos con:
 *
 *   npm run db:types
 *
 * (necesita `npx supabase login` y el project ref en el script de package.json)
 */

export type TripStatus =
  | 'draft'
  | 'collecting'
  | 'generating'
  | 'voting'
  | 'finalized';

export type BudgetMode = 'individual' | 'group';
export type ParticipantRole = 'organizer' | 'member';
export type CategoryStance = 'favorite' | 'neutral' | 'hated';
export type VoteValue = 'for' | 'abstain' | 'against';

/** Máximo de regeneraciones tras la propuesta inicial. */
export const MAX_REGENERATIONS = 2;

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type Category = {
  id: string;
  slug: string;
  label: string;
  emoji: string | null;
  sort_order: number;
}

export type Trip = {
  id: string;
  organizer_id: string;
  title: string;
  destination: string | null;
  days: number;
  start_date: string | null;
  budget_mode: BudgetMode;
  group_budget: number | null;
  status: TripStatus;
  invite_code: string;
  regenerations_used: number;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type TripParticipant = {
  id: string;
  trip_id: string;
  user_id: string;
  role: ParticipantRole;
  joined_at: string;
}

export type Preference = {
  id: string;
  trip_id: string;
  user_id: string;
  budget_amount: number | null;
  vetoes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PreferenceCategory = {
  id: string;
  preference_id: string;
  category_id: string;
  stance: CategoryStance;
}

export type DestinationProposal = {
  id: string;
  trip_id: string;
  /** null = quien lo propuso borró su cuenta; la propuesta se conserva anonimizada. */
  user_id: string | null;
  name: string;
  country: string | null;
  notes: string | null;
  lat: number | null;
  lon: number | null;
  created_at: string;
}

export type ItineraryVersion = {
  id: string;
  trip_id: string;
  version_number: number;
  rationale: string | null;
  raw_response: unknown | null;
  model: string | null;
  is_current: boolean;
  created_at: string;
}

export type ItineraryActivity = {
  id: string;
  version_id: string;
  day_number: number;
  position: number;
  title: string;
  description: string | null;
  category_id: string | null;
  start_time: string | null;
  duration_min: number | null;
  estimated_cost: number | null;
  place_name: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  created_at: string;
}

export type Vote = {
  id: string;
  activity_id: string;
  /** null = quien votó borró su cuenta; el voto se conserva anonimizado. */
  user_id: string | null;
  value: VoteValue;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

/** Columnas que la BD rellena sola y que nunca se envían en un insert. */
type Generated = 'id' | 'created_at' | 'updated_at';

type TableOf<Row, OptionalOnInsert extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Extract<Generated, keyof Row> | OptionalOnInsert> &
    Partial<Pick<Row, Extract<Generated, keyof Row> | OptionalOnInsert>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableOf<Profile, 'display_name' | 'avatar_url'>;
      categories: TableOf<Category, 'emoji' | 'sort_order'>;
      trips: TableOf<
        Trip,
        | 'destination'
        | 'start_date'
        | 'budget_mode'
        | 'group_budget'
        | 'status'
        | 'invite_code'
        | 'regenerations_used'
        | 'photo_url'
      >;
      trip_participants: TableOf<TripParticipant, 'role' | 'joined_at'>;
      preferences: TableOf<
        Preference,
        'budget_amount' | 'vetoes' | 'submitted_at'
      >;
      preference_categories: TableOf<PreferenceCategory, 'stance'>;
      destination_proposals: TableOf<
        DestinationProposal,
        'country' | 'notes' | 'lat' | 'lon'
      >;
      itinerary_versions: TableOf<
        ItineraryVersion,
        'rationale' | 'raw_response' | 'model' | 'is_current'
      >;
      itinerary_activities: TableOf<
        ItineraryActivity,
        | 'description'
        | 'category_id'
        | 'start_time'
        | 'duration_min'
        | 'estimated_cost'
        | 'place_name'
        | 'address'
        | 'lat'
        | 'lon'
        | 'position'
      >;
      votes: TableOf<Vote, 'comment'>;
    };
    Views: Record<never, never>;
    Functions: {
      join_trip: {
        Args: { p_code: string };
        Returns: string;
      };
      leave_trip: {
        Args: { p_trip_id: string };
        Returns: string;
      };
      transfer_organizer: {
        Args: { p_trip_id: string; p_new_organizer: string };
        Returns: undefined;
      };
      set_trip_photo: {
        Args: { p_trip_id: string; p_photo_url: string | null };
        Returns: undefined;
      };
    };
    Enums: {
      trip_status: TripStatus;
      budget_mode: BudgetMode;
      participant_role: ParticipantRole;
      category_stance: CategoryStance;
      vote_value: VoteValue;
    };
    CompositeTypes: Record<never, never>;
  };
}
