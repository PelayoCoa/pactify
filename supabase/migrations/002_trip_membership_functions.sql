-- =============================================================================
-- Migración 002 — funciones de pertenencia a un viaje
--
-- Salir de un viaje y transferir el rol de organizador. Van como funciones
-- SECURITY DEFINER porque:
--   · transferir cambia el role de OTRA persona en trip_participants, y esa
--     tabla no tiene policy de UPDATE (a propósito).
--   · cambiar trips.organizer_id a otro usuario choca con el WITH CHECK de la
--     policy de update de trips (exige organizer_id = auth.uid()).
-- El DEFINER salta RLS; la comprobación de permisos se hace dentro a mano.
--
-- Ejecutar una vez en el SQL Editor. Idempotente (create or replace).
-- =============================================================================

-- Transfiere el rol de organizador a otro participante.
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

-- Salir de un viaje.
--   · participante normal  → se borra su fila.
--   · organizador con más gente → error ORGANIZER_MUST_TRANSFER (que transfiera).
--   · organizador que está solo → se borra el viaje entero (cascade).
-- Devuelve qué pasó: 'LEFT' | 'TRIP_DELETED'.
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

-- Unirse por código de invitación.
--   Necesario como función: la policy de SELECT de `trips` solo deja ver un
--   viaje si YA eres participante, así que un recién llegado no puede resolver
--   el código a mano. Aquí se resuelve saltando RLS y se inserta el participante.
--   Idempotente: si ya estás dentro, devuelve el id igual.
--   Devuelve el trip_id.
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
