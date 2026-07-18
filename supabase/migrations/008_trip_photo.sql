-- =============================================================================
-- Migración 008 — foto de grupo del viaje
--
-- HALLAZGO antes de construir esto: la policy de UPDATE de `trips` es
--
--   using (organizer_id = auth.uid())
--
-- Solo el organizador puede actualizar la fila. Lo pedido hoy es que
-- CUALQUIER participante pueda cambiar la foto -"como en un grupo de
-- WhatsApp"-. Ampliar esa policy a "organizador o participante" dejaría
-- también que cualquiera renombrara el viaje, cambiara el presupuesto o el
-- modo, cosas que NO se han pedido y que rompen el reparto de responsabilidad
-- organizador/participante que ya tiene el resto de la app.
--
-- RLS de Postgres no distingue por columna dentro de una misma policy, así
-- que en vez de tocar esa policy general se usa el mismo patrón que ya usan
-- join_trip/leave_trip/transfer_organizer: una función SECURITY DEFINER
-- estrecha, que solo puede tocar photo_url y solo si quien llama es
-- participante del viaje (organizador incluido, is_trip_participant() ya lo
-- cubre porque el organizador también tiene fila en trip_participants).
--
-- SEGURIDAD DEL BUCKET: se deja público, igual que `avatars`. Nota para quien
-- lea esto: a diferencia de los perfiles (que ya son visibles para cualquier
-- autenticado), los viajes NO son públicos -solo los ve quien participa-. Un
-- bucket público bypassa RLS para quien tenga la URL exacta. En la práctica
-- el riesgo es el mismo que ya se acepta con avatars: la URL incluye un UUID
-- del viaje (aleatorio, no listable) igual que el UUID del usuario en
-- avatars, así que hace falta ya conocer/filtrar ese UUID para verla -no es
-- alcanzable navegando ni listando-. Aun así, si prefieres bucket privado con
-- URLs firmadas en vez de esto, dilo y se cambia.
--
-- Ejecutar una vez en el SQL Editor. Idempotente.
-- =============================================================================

alter table public.trips add column if not exists photo_url text;

create or replace function public.set_trip_photo(p_trip_id uuid, p_photo_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trip_participant(p_trip_id) then
    raise exception 'NOT_PARTICIPANT' using errcode = 'P0001';
  end if;

  update public.trips set photo_url = p_photo_url where id = p_trip_id;
end;
$$;

revoke all on function public.set_trip_photo(uuid, text) from public;
grant execute on function public.set_trip_photo(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-photos',
  'trip-photos',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Convención de path: {trip_id}/{timestamp}.{ext} -el primer segmento del
-- nombre es el trip_id, igual que en avatars el primer segmento es el
-- user_id-. Cualquier participante (organizador incluido) puede escribir.
drop policy if exists "foto de viaje: participantes suben" on storage.objects;
create policy "foto de viaje: participantes suben"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'trip-photos'
    and public.is_trip_participant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "foto de viaje: participantes reemplazan" on storage.objects;
create policy "foto de viaje: participantes reemplazan"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'trip-photos'
    and public.is_trip_participant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "foto de viaje: participantes borran" on storage.objects;
create policy "foto de viaje: participantes borran"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'trip-photos'
    and public.is_trip_participant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "foto de viaje: participantes ven" on storage.objects;
create policy "foto de viaje: participantes ven"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'trip-photos'
    and public.is_trip_participant(((storage.foldername(name))[1])::uuid)
  );
