-- =============================================================================
-- Migración 003 — arregla "new row violates RLS policy" al crear un viaje
--
-- Causa raíz confirmada con logs: al hacer INSERT ... RETURNING (que es lo
-- que .insert().select() genera), Postgres evalúa la policy de SELECT sobre
-- la fila recién insertada para decidir si puede devolverla. La policy de
-- SELECT de trips dependía solo de is_trip_participant(id), y esa fila la
-- crea el trigger on_trip_created — que es AFTER INSERT, o sea que se
-- dispara DESPUÉS de que el RETURNING ya decidió si la fila era visible.
--
-- Resultado: el organizador aún no consta como participante en el instante
-- exacto en que se evalúa el RETURNING → la fila "no es visible" → 42501,
-- aunque el INSERT en sí (WITH CHECK organizer_id = auth.uid()) sea correcto
-- y la fila SÍ quede insertada.
--
-- Fix: el organizador siempre puede ver su propio viaje por columna,
-- sin depender de que el trigger ya haya corrido.
--
-- Ejecutar una vez en el SQL Editor. Idempotente.
-- =============================================================================

drop policy if exists "participantes ven su viaje" on public.trips;
create policy "participantes ven su viaje"
  on public.trips for select
  to authenticated
  using (
    organizer_id = auth.uid()
    or public.is_trip_participant(id)
  );
