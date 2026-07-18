-- =============================================================================
-- Pactify — esquema completo
-- Ejecutar entero en el SQL Editor de Supabase. Es idempotente: se puede
-- relanzar sin romper nada.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------

do $$ begin
  -- Ciclo de vida del viaje.
  create type trip_status as enum (
    'draft',       -- el organizador aún lo está configurando
    'collecting',  -- los participantes rellenan preferencias
    'generating',  -- la IA está trabajando
    'voting',      -- hay itinerario y la gente vota
    'finalized'    -- cerrado, se muestra en el mapa
  );
exception when duplicate_object then null; end $$;

do $$ begin
  -- individual = cada uno pone su presupuesto; group = un bote común.
  create type budget_mode as enum ('individual', 'group');
exception when duplicate_object then null; end $$;

do $$ begin
  create type participant_role as enum ('organizer', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Postura de un participante ante una categoría del checklist.
  create type category_stance as enum ('favorite', 'neutral', 'hated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vote_value as enum ('for', 'abstain', 'against');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. Utilidades
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Código corto para compartir el viaje (p. ej. "K3F9QZ").
create or replace function public.generate_invite_code()
returns text
language sql
volatile
as $$
  select upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 6));
$$;

-- -----------------------------------------------------------------------------
-- 3. profiles — espejo de auth.users
--    auth.users es de Supabase y no se puede consultar desde el cliente con
--    joins, así que replicamos lo mínimo aquí.
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Alta automática del perfil al registrarse (el magic link crea el auth.user).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. categories — checklist de intereses (playa, museos, estadios...)
--    En tabla y no en enum: así el checklist del formulario se renderiza desde
--    la BD y añadir una categoría no obliga a migrar.
-- -----------------------------------------------------------------------------

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  emoji      text,
  sort_order int  not null default 0
);

insert into public.categories (slug, label, emoji, sort_order) values
  ('beach',       'Playa',            '🏖️', 10),
  ('museums',     'Museos',           '🏛️', 20),
  ('stadiums',    'Estadios',         '🏟️', 30),
  ('monuments',   'Monumentos',       '🗿', 40),
  ('food',        'Gastronomía',      '🍽️', 50),
  ('nightlife',   'Vida nocturna',    '🌃', 60),
  ('nature',      'Naturaleza',       '🌲', 70),
  ('shopping',    'Compras',          '🛍️', 80),
  ('adventure',   'Aventura',         '🧗', 90),
  ('relax',       'Relax',            '🧘', 100)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- 5. trips
-- -----------------------------------------------------------------------------

create table if not exists public.trips (
  id            uuid primary key default gen_random_uuid(),
  -- on delete restrict a propósito: borrar un perfil NUNCA debe arrastrar en
  -- cascada un viaje entero (con la gente y el itinerario de otros) solo
  -- porque esa persona era la organizadora. La lógica de borrado de cuenta
  -- transfiere el rol (o borra el viaje si estaba solo) ANTES de llegar aquí;
  -- este RESTRICT es la red de seguridad si algún día eso falla.
  organizer_id  uuid not null references public.profiles (id) on delete restrict,
  title         text not null,
  -- Destino ganador. Null hasta que la IA lo elige entre las propuestas.
  destination   text,
  days          int  not null check (days between 1 and 30),
  start_date    date,
  budget_mode   budget_mode not null default 'individual',
  -- Solo se usa cuando budget_mode = 'group' (bote común en EUR).
  group_budget  numeric(10, 2) check (group_budget is null or group_budget >= 0),
  status        trip_status not null default 'draft',
  invite_code   text not null unique default public.generate_invite_code(),
  -- Regeneraciones consumidas. La v1 es la generación inicial, no cuenta.
  regenerations_used int not null default 0 check (regenerations_used between 0 and 2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Coherencia entre modo de presupuesto y bote común.
  constraint group_budget_matches_mode check (
    (budget_mode = 'group'      and group_budget is not null) or
    (budget_mode = 'individual' and group_budget is null)
  )
);

create index if not exists trips_organizer_idx   on public.trips (organizer_id);
create index if not exists trips_invite_code_idx on public.trips (invite_code);

drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. trip_participants
-- -----------------------------------------------------------------------------

create table if not exists public.trip_participants (
  id        uuid primary key default gen_random_uuid(),
  trip_id   uuid not null references public.trips (id)    on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      participant_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create index if not exists trip_participants_trip_idx on public.trip_participants (trip_id);
create index if not exists trip_participants_user_idx on public.trip_participants (user_id);

-- El organizador entra como participante en cuanto crea el viaje.
create or replace function public.add_organizer_as_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trip_participants (trip_id, user_id, role)
  values (new.id, new.organizer_id, 'organizer')
  on conflict (trip_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_trip_created on public.trips;
create trigger on_trip_created
  after insert on public.trips
  for each row execute function public.add_organizer_as_participant();

-- -----------------------------------------------------------------------------
-- 7. Helpers de RLS
--    SECURITY DEFINER a propósito: si una policy de trip_participants
--    consultara trip_participants directamente, Postgres entraría en recursión
--    infinita. Estas funciones saltan RLS y cortan el ciclo.
-- -----------------------------------------------------------------------------

create or replace function public.is_trip_participant(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_participants
    where trip_id = p_trip_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_organizer(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trips
    where id = p_trip_id and organizer_id = auth.uid()
  );
$$;

-- ¿el usuario actual comparte al menos un viaje con `p_other`? Usado por la
-- policy de SELECT de profiles para no exponer el email de todos los
-- registrados a cualquier cuenta (ver migración 009). SECURITY DEFINER por el
-- mismo motivo que is_trip_participant: consultar trip_participants bajo RLS
-- provocaría la recursión que esas policies ya evitan.
create or replace function public.shares_trip_with(p_other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_participants me
    join public.trip_participants them on them.trip_id = me.trip_id
    where me.user_id = auth.uid()
      and them.user_id = p_other
  );
$$;

-- -----------------------------------------------------------------------------
-- 8. preferences — una fila por (viaje, persona)
-- -----------------------------------------------------------------------------

create table if not exists public.preferences (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id)    on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  -- Presupuesto personal en EUR. En modo 'group' puede quedar a null.
  budget_amount numeric(10, 2) check (budget_amount is null or budget_amount >= 0),
  -- Vetos en texto libre: "nada de madrugar", "soy alérgico al marisco".
  vetoes        text,
  -- Null mientras es un borrador; se marca al confirmar el formulario.
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (trip_id, user_id)
);

create index if not exists preferences_trip_idx on public.preferences (trip_id);

drop trigger if exists preferences_set_updated_at on public.preferences;
create trigger preferences_set_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

-- Checklist: postura de esa persona ante cada categoría.
create table if not exists public.preference_categories (
  id            uuid primary key default gen_random_uuid(),
  preference_id uuid not null references public.preferences (id) on delete cascade,
  category_id   uuid not null references public.categories (id)  on delete cascade,
  stance        category_stance not null default 'neutral',
  unique (preference_id, category_id)
);

create index if not exists preference_categories_pref_idx on public.preference_categories (preference_id);

-- Bloqueo real tras confirmar: las policies de escritura solo miran
-- user_id = auth.uid(), nada mira submitted_at. Sin este trigger, el dueño
-- de la fila podría seguir escribiendo vía API directa tras confirmar,
-- aunque la UI lo bloquee. (Mismo contenido que migrations/004.)
create or replace function public.check_preferences_not_locked()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    if old.submitted_at is not null then
      raise exception 'PREFERENCES_LOCKED' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if old.submitted_at is not null then
    raise exception 'PREFERENCES_LOCKED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists preferences_lock_guard on public.preferences;
create trigger preferences_lock_guard
  before update on public.preferences
  for each row execute function public.check_preferences_not_locked();

create or replace function public.check_preference_categories_not_locked()
returns trigger
language plpgsql
as $$
declare
  v_locked boolean;
begin
  select (submitted_at is not null) into v_locked
    from public.preferences
   where id = coalesce(new.preference_id, old.preference_id);

  if v_locked then
    raise exception 'PREFERENCES_LOCKED' using errcode = 'P0001';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists preference_categories_lock_guard on public.preference_categories;
create trigger preference_categories_lock_guard
  before insert or update or delete on public.preference_categories
  for each row execute function public.check_preference_categories_not_locked();

-- -----------------------------------------------------------------------------
-- 9. destination_proposals — destinos que propone cada participante
-- -----------------------------------------------------------------------------

create table if not exists public.destination_proposals (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  -- Nullable + set null: si quien propuso el sitio borra su cuenta, la
  -- propuesta sigue siendo útil para el grupo. Queda "anonimizada" (sin
  -- dueño) en vez de desaparecer con la persona.
  user_id    uuid references public.profiles (id) on delete set null,
  name       text not null,
  country    text,
  notes      text,
  -- Se rellenan con el geocoder de MapTiler al proponer.
  lat        double precision check (lat between -90  and 90),
  lon        double precision check (lon between -180 and 180),
  created_at timestamptz not null default now(),
  -- La misma persona no propone dos veces el mismo sitio; otra sí puede.
  unique (trip_id, user_id, name)
);

create index if not exists destination_proposals_trip_idx on public.destination_proposals (trip_id);

-- -----------------------------------------------------------------------------
-- 10. itinerary_versions — v1 inicial + hasta 2 regeneraciones = v3 como techo
-- -----------------------------------------------------------------------------

create table if not exists public.itinerary_versions (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  version_number int  not null check (version_number between 1 and 3),
  -- Explicación de la IA: cómo ha equilibrado gustos y vetos.
  rationale      text,
  -- Respuesta cruda de Claude, por si hay que depurar o reprocesar.
  raw_response   jsonb,
  model          text,
  -- true solo en la versión que se está mostrando y votando ahora mismo.
  is_current     boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (trip_id, version_number)
);

-- Un único itinerario "actual" por viaje.
create unique index if not exists itinerary_versions_one_current_idx
  on public.itinerary_versions (trip_id)
  where is_current;

-- Al insertar una versión nueva, la anterior deja de ser la actual.
create or replace function public.demote_previous_itinerary_version()
returns trigger
language plpgsql
as $$
begin
  if new.is_current then
    update public.itinerary_versions
       set is_current = false
     where trip_id = new.trip_id
       and id <> new.id
       and is_current;
  end if;
  return new;
end;
$$;

drop trigger if exists on_itinerary_version_created on public.itinerary_versions;
create trigger on_itinerary_version_created
  before insert on public.itinerary_versions
  for each row execute function public.demote_previous_itinerary_version();

-- -----------------------------------------------------------------------------
-- 11. itinerary_activities — lo que se vota y lo que se pinta en el mapa
-- -----------------------------------------------------------------------------

create table if not exists public.itinerary_activities (
  id             uuid primary key default gen_random_uuid(),
  version_id     uuid not null references public.itinerary_versions (id) on delete cascade,
  day_number     int  not null check (day_number >= 1),
  -- Orden dentro del día.
  position       int  not null default 0,
  title          text not null,
  description    text,
  category_id    uuid references public.categories (id) on delete set null,
  start_time     time,
  duration_min   int check (duration_min is null or duration_min > 0),
  -- Coste estimado por persona, en EUR.
  estimated_cost numeric(10, 2) check (estimated_cost is null or estimated_cost >= 0),
  place_name     text,
  address        text,
  lat            double precision check (lat between -90  and 90),
  lon            double precision check (lon between -180 and 180),
  created_at     timestamptz not null default now(),
  unique (version_id, day_number, position)
);

create index if not exists itinerary_activities_version_idx on public.itinerary_activities (version_id);

-- -----------------------------------------------------------------------------
-- 12. votes — un voto por persona y actividad
-- -----------------------------------------------------------------------------

create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.itinerary_activities (id) on delete cascade,
  -- Nullable + set null: el voto sobrevive al borrado de cuenta de quien lo
  -- emitió, con autor null = anonimizado. Con CASCADE aquí sería imposible
  -- cumplir "los votos se quedan pero anonimizados" — Postgres borraría la
  -- fila entera, no dejaría nada que anonimizar.
  user_id     uuid references public.profiles (id) on delete set null,
  value       vote_value not null,
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (activity_id, user_id)
);

create index if not exists votes_activity_idx on public.votes (activity_id);

drop trigger if exists votes_set_updated_at on public.votes;
create trigger votes_set_updated_at
  before update on public.votes
  for each row execute function public.set_updated_at();

-- Resuelve el trip_id de un voto sin joins en la policy.
create or replace function public.trip_id_of_activity(p_activity_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select v.trip_id
    from public.itinerary_activities a
    join public.itinerary_versions v on v.id = a.version_id
   where a.id = p_activity_id;
$$;

-- Bloquea votos fuera de la ronda abierta: las policies de abajo solo miran
-- user_id/participante, ninguna mira si la versión sigue siendo la actual o
-- si el viaje sigue en 'voting'. Sin esto, se podría seguir votando una
-- versión ya sustituida por una regeneración, o después de "decisión final".
-- (Mismo contenido que migrations/005.)
create or replace function public.check_vote_round_open()
returns trigger
language plpgsql
as $$
declare
  v_is_current boolean;
  v_status     trip_status;
begin
  select v.is_current, t.status
    into v_is_current, v_status
    from public.itinerary_activities a
    join public.itinerary_versions v on v.id = a.version_id
    join public.trips t on t.id = v.trip_id
   where a.id = new.activity_id;

  if v_is_current is null then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not v_is_current then
    raise exception 'VOTE_ON_OLD_VERSION' using errcode = 'P0001';
  end if;

  if v_status <> 'voting' then
    raise exception 'VOTING_CLOSED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists votes_round_open_guard on public.votes;
create trigger votes_round_open_guard
  before insert or update on public.votes
  for each row execute function public.check_vote_round_open();

-- =============================================================================
-- 13. Row Level Security
--     Regla de oro: solo ves un viaje si eres participante; solo escribes tus
--     propias filas; solo el organizador toca la configuración del viaje.
-- =============================================================================

alter table public.profiles              enable row level security;
alter table public.categories            enable row level security;
alter table public.trips                 enable row level security;
alter table public.trip_participants     enable row level security;
alter table public.preferences           enable row level security;
alter table public.preference_categories enable row level security;
alter table public.destination_proposals enable row level security;
alter table public.itinerary_versions    enable row level security;
alter table public.itinerary_activities  enable row level security;
alter table public.votes                 enable row level security;

-- profiles ---------------------------------------------------------------
-- Solo tu propio perfil, o el de alguien con quien compartes un viaje. Antes
-- era using(true), que dejaba a cualquier cuenta leer el email de TODOS los
-- registrados (ver migración 009). La app solo necesita ver a compañeros de
-- viaje (lista de participantes, propuestas, contexto de la IA).
drop policy if exists "perfiles visibles para usuarios autenticados" on public.profiles;
create policy "perfiles visibles para usuarios autenticados"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.shares_trip_with(id)
  );

drop policy if exists "cada uno edita su perfil" on public.profiles;
create policy "cada uno edita su perfil"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- categories (catálogo de solo lectura) ----------------------------------
drop policy if exists "categorias legibles por todos" on public.categories;
create policy "categorias legibles por todos"
  on public.categories for select
  to authenticated
  using (true);

-- trips ------------------------------------------------------------------
-- organizer_id = auth.uid() como fallback: RETURNING de un INSERT evalúa esta
-- policy de SELECT sobre la fila recién insertada, y el trigger que añade al
-- organizador a trip_participants es AFTER INSERT (corre después). Sin este
-- fallback, is_trip_participant(id) aún no ve esa fila y el INSERT...RETURNING
-- revienta con "new row violates row-level security policy".
drop policy if exists "participantes ven su viaje" on public.trips;
create policy "participantes ven su viaje"
  on public.trips for select
  to authenticated
  using (
    organizer_id = auth.uid()
    or public.is_trip_participant(id)
  );

drop policy if exists "cualquiera crea un viaje siendo organizador" on public.trips;
create policy "cualquiera crea un viaje siendo organizador"
  on public.trips for insert
  to authenticated
  with check (organizer_id = auth.uid());

drop policy if exists "solo el organizador edita el viaje" on public.trips;
create policy "solo el organizador edita el viaje"
  on public.trips for update
  to authenticated
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid());

drop policy if exists "solo el organizador borra el viaje" on public.trips;
create policy "solo el organizador borra el viaje"
  on public.trips for delete
  to authenticated
  using (organizer_id = auth.uid());

-- trip_participants ------------------------------------------------------
drop policy if exists "participantes se ven entre si" on public.trip_participants;
create policy "participantes se ven entre si"
  on public.trip_participants for select
  to authenticated
  using (public.is_trip_participant(trip_id));

drop policy if exists "unirse a un viaje" on public.trip_participants;
create policy "unirse a un viaje"
  on public.trip_participants for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_trip_organizer(trip_id));

drop policy if exists "salirse o expulsar" on public.trip_participants;
create policy "salirse o expulsar"
  on public.trip_participants for delete
  to authenticated
  using (user_id = auth.uid() or public.is_trip_organizer(trip_id));

-- preferences ------------------------------------------------------------
-- Todos los del grupo ven las preferencias de todos: es lo que alimenta el
-- prompt y lo que hace transparente el reparto.
drop policy if exists "participantes leen preferencias del viaje" on public.preferences;
create policy "participantes leen preferencias del viaje"
  on public.preferences for select
  to authenticated
  using (public.is_trip_participant(trip_id));

drop policy if exists "cada uno escribe sus preferencias" on public.preferences;
create policy "cada uno escribe sus preferencias"
  on public.preferences for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_trip_participant(trip_id));

drop policy if exists "cada uno actualiza sus preferencias" on public.preferences;
create policy "cada uno actualiza sus preferencias"
  on public.preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- preference_categories --------------------------------------------------
drop policy if exists "leer checklist del viaje" on public.preference_categories;
create policy "leer checklist del viaje"
  on public.preference_categories for select
  to authenticated
  using (exists (
    select 1 from public.preferences p
     where p.id = preference_id and public.is_trip_participant(p.trip_id)
  ));

drop policy if exists "escribir el propio checklist" on public.preference_categories;
create policy "escribir el propio checklist"
  on public.preference_categories for all
  to authenticated
  using (exists (
    select 1 from public.preferences p
     where p.id = preference_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.preferences p
     where p.id = preference_id and p.user_id = auth.uid()
  ));

-- destination_proposals --------------------------------------------------
drop policy if exists "participantes ven las propuestas" on public.destination_proposals;
create policy "participantes ven las propuestas"
  on public.destination_proposals for select
  to authenticated
  using (public.is_trip_participant(trip_id));

drop policy if exists "cada uno propone destinos" on public.destination_proposals;
create policy "cada uno propone destinos"
  on public.destination_proposals for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_trip_participant(trip_id));

drop policy if exists "cada uno retira su propuesta" on public.destination_proposals;
create policy "cada uno retira su propuesta"
  on public.destination_proposals for delete
  to authenticated
  using (user_id = auth.uid());

-- itinerary_versions / activities ----------------------------------------
-- Los participantes leen; escribe solo el servidor (service_role), que es
-- quien llama a Claude. Así nadie puede inyectarse actividades a mano.
drop policy if exists "participantes leen itinerarios" on public.itinerary_versions;
create policy "participantes leen itinerarios"
  on public.itinerary_versions for select
  to authenticated
  using (public.is_trip_participant(trip_id));

drop policy if exists "participantes leen actividades" on public.itinerary_activities;
create policy "participantes leen actividades"
  on public.itinerary_activities for select
  to authenticated
  using (exists (
    select 1 from public.itinerary_versions v
     where v.id = version_id and public.is_trip_participant(v.trip_id)
  ));

-- votes ------------------------------------------------------------------
drop policy if exists "participantes ven todos los votos" on public.votes;
create policy "participantes ven todos los votos"
  on public.votes for select
  to authenticated
  using (public.is_trip_participant(public.trip_id_of_activity(activity_id)));

drop policy if exists "cada uno vota por si mismo" on public.votes;
create policy "cada uno vota por si mismo"
  on public.votes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_trip_participant(public.trip_id_of_activity(activity_id))
  );

drop policy if exists "cada uno cambia su voto" on public.votes;
create policy "cada uno cambia su voto"
  on public.votes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "cada uno retira su voto" on public.votes;
create policy "cada uno retira su voto"
  on public.votes for delete
  to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- 14. Funciones de pertenencia (salir / transferir organizador)
--     SECURITY DEFINER: cambian filas de otros y saltan las policies que, a
--     propósito, no permiten esos cambios desde el cliente. Permisos validados
--     dentro a mano. (Mismo contenido que migrations/002.)
-- =============================================================================

create or replace function public.transfer_organizer(
  p_trip_id       uuid,
  p_new_organizer uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (
    select 1 from public.trips
     where id = p_trip_id and organizer_id = v_uid
  ) then
    raise exception 'NOT_ORGANIZER' using errcode = 'P0001';
  end if;

  if p_new_organizer = v_uid then
    raise exception 'ALREADY_ORGANIZER' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.trip_participants
     where trip_id = p_trip_id and user_id = p_new_organizer
  ) then
    raise exception 'NEW_ORGANIZER_NOT_PARTICIPANT' using errcode = 'P0001';
  end if;

  update public.trips
     set organizer_id = p_new_organizer
   where id = p_trip_id;

  update public.trip_participants
     set role = 'organizer'
   where trip_id = p_trip_id and user_id = p_new_organizer;

  update public.trip_participants
     set role = 'member'
   where trip_id = p_trip_id and user_id = v_uid;
end;
$$;

create or replace function public.leave_trip(p_trip_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_is_organizer boolean;
  v_others       int;
begin
  if not exists (
    select 1 from public.trip_participants
     where trip_id = p_trip_id and user_id = v_uid
  ) then
    raise exception 'NOT_PARTICIPANT' using errcode = 'P0001';
  end if;

  select (organizer_id = v_uid) into v_is_organizer
    from public.trips where id = p_trip_id;

  if v_is_organizer then
    select count(*) into v_others
      from public.trip_participants
     where trip_id = p_trip_id and user_id <> v_uid;

    if v_others > 0 then
      raise exception 'ORGANIZER_MUST_TRANSFER' using errcode = 'P0001';
    end if;

    delete from public.trips where id = p_trip_id;  -- cascade borra al participante
    return 'TRIP_DELETED';
  end if;

  delete from public.trip_participants
   where trip_id = p_trip_id and user_id = v_uid;
  return 'LEFT';
end;
$$;

create or replace function public.join_trip(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trip_id uuid;
begin
  select id into v_trip_id
    from public.trips
   where invite_code = upper(trim(p_code));

  if v_trip_id is null then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;

  insert into public.trip_participants (trip_id, user_id, role)
  values (v_trip_id, v_uid, 'member')
  on conflict (trip_id, user_id) do nothing;

  return v_trip_id;
end;
$$;

revoke all on function public.transfer_organizer(uuid, uuid) from public;
revoke all on function public.leave_trip(uuid)              from public;
revoke all on function public.join_trip(text)               from public;
grant execute on function public.transfer_organizer(uuid, uuid) to authenticated;
grant execute on function public.leave_trip(uuid)              to authenticated;
grant execute on function public.join_trip(text)               to authenticated;
