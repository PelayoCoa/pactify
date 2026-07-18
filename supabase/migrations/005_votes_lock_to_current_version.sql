-- =============================================================================
-- Migración 005 — bloquea votos fuera de la ronda abierta
--
-- Gap encontrado (mismo patrón que las 3 veces anteriores en este proyecto):
-- las policies de votes solo comprueban user_id = auth.uid() y que seas
-- participante del viaje. Ninguna mira si la versión del itinerario sigue
-- siendo la actual, ni si el viaje sigue en estado 'voting'.
--
-- Sin este trigger, alguien podría seguir votando actividades de una versión
-- vieja (ya sustituida por una regeneración) o votar después de que el
-- organizador cerrara la votación con "decisión final" (trips.status pasa a
-- 'finalized'). No es una brecha de privilegios -nadie vota por otro-, pero
-- sí datos basura: votos "vigentes" sobre algo que ya no se puede cambiar.
--
-- Fix: trigger BEFORE INSERT/UPDATE en votes que resuelve la versión y el
-- estado del viaje de la actividad votada, y rechaza si la versión no es la
-- actual o el viaje no está en 'voting'.
--
-- Ejecutar una vez en el SQL Editor. Idempotente.
-- =============================================================================

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
