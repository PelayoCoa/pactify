-- =============================================================================
-- Migración 009 — cierra la fuga de emails entre cuentas
--
-- HALLAZGO (auditoría de seguridad): la policy de SELECT de `profiles` era
--
--   using (true)
--
-- Como `profiles` guarda `email` de cada usuario y el registro por magic-link
-- está abierto (shouldCreateUser: true), CUALQUIER persona podía crear una
-- cuenta y, desde el navegador con la anon key, hacer
--   supabase.from('profiles').select('email, display_name, avatar_url')
-- y cosechar el email de TODOS los registrados de Pactify -no solo de sus
-- compañeros de viaje-. Fuga de datos personales de manual.
--
-- La app solo necesita ver el nombre/avatar de otra persona en un caso: que
-- comparta un viaje contigo (lista de participantes, propuestas de destino,
-- contexto que alimenta a la IA). Se restringe la policy exactamente a eso:
-- tu propio perfil, o el de alguien con quien compartes al menos un viaje.
--
-- El helper es SECURITY DEFINER (salta RLS por dentro) por el mismo motivo
-- que is_trip_participant: si consultara trip_participants bajo RLS entraría
-- en la recursión que esas policies ya evitan. search_path fijado a public.
--
-- Ejecutar una vez en el SQL Editor. Idempotente.
-- =============================================================================

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

drop policy if exists "perfiles visibles para usuarios autenticados" on public.profiles;
create policy "perfiles visibles para usuarios autenticados"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.shares_trip_with(id)
  );
