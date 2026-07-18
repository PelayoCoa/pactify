-- =============================================================================
-- Migración 006 — arregla los FK antes de poder borrar una cuenta con cuidado
--
-- HALLAZGO GRAVE (el más serio de los 5 encontrados en este proyecto):
--
-- `trips.organizer_id references public.profiles (id) on delete cascade`
--
-- Tal cual estaba, borrar el perfil de un usuario BORRABA EN CASCADA CADA
-- VIAJE QUE ORGANIZABA ENTERO -itinerario, actividades, votos de TODOS los
-- demás participantes, todo- solo porque el organizador se dio de baja. Es
-- justo lo contrario de lo que se pidió hoy ("no borres el viaje... por su
-- culpa"). Si hubiera construido el endpoint de borrado de cuenta sin arreglar
-- esto antes, habría funcionado en las pruebas simples y habría reventado el
-- viaje de un grupo entero la primera vez que un organizador real borrara su
-- cuenta.
--
-- Segundo hallazgo, mismo problema en votes:
--
-- `votes.user_id references public.profiles (id) on delete cascade`
--
-- Esto borraba los votos enteros al borrar el perfil. Se pidió explícitamente
-- que los votos se queden pero anonimizados. Con CASCADE eso es imposible:
-- Postgres borra la fila entera, no queda nada que anonimizar.
--
-- Mismo trato para destination_proposals.user_id (no mencionado explícitamente
-- hoy, pero por el mismo motivo: si alguien propuso el Museo del Prado y luego
-- borra su cuenta, esa propuesta sigue siendo información útil para el grupo,
-- no hay razón para que desaparezca con la persona).
--
-- FIX:
--   - trips.organizer_id       → ON DELETE RESTRICT (red de seguridad: la
--     lógica de borrado de cuenta transfiere el rol o borra el viaje ENTERO
--     solo si estaba solo, ANTES de llegar aquí; si algún día un bug se salta
--     ese paso, Postgres bloquea el borrado con un error claro en vez de
--     arrasar un viaje compartido en silencio).
--   - votes.user_id            → nullable + ON DELETE SET NULL (el voto
--     sobrevive con autor null = anonimizado).
--   - destination_proposals.user_id → igual, nullable + ON DELETE SET NULL.
--
-- Los UNIQUE que incluyen estas columnas (activity_id+user_id,
-- trip_id+user_id+name) siguen funcionando: en SQL estándar varios NULL en
-- una misma columna de un UNIQUE no chocan entre sí, así que pueden convivir
-- muchos votos ya anonimizados sobre la misma actividad sin violar nada.
--
-- Ejecutar una vez en el SQL Editor. Idempotente.
-- =============================================================================

alter table public.trips
  drop constraint if exists trips_organizer_id_fkey,
  add constraint trips_organizer_id_fkey
    foreign key (organizer_id) references public.profiles (id)
    on delete restrict;

alter table public.votes
  alter column user_id drop not null,
  drop constraint if exists votes_user_id_fkey,
  add constraint votes_user_id_fkey
    foreign key (user_id) references public.profiles (id)
    on delete set null;

alter table public.destination_proposals
  alter column user_id drop not null,
  drop constraint if exists destination_proposals_user_id_fkey,
  add constraint destination_proposals_user_id_fkey
    foreign key (user_id) references public.profiles (id)
    on delete set null;
