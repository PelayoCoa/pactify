-- =============================================================================
-- Diagnóstico del error "new row violates RLS policy for table trips"
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PASO 1. ¿Existe la policy de INSERT y es la correcta?  (caso B)
--   Espera 1 fila: cmd = INSERT, roles = {authenticated},
--   with_check = (organizer_id = auth.uid())
-- ---------------------------------------------------------------------------
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'trips'
order by cmd;

-- ¿RLS activo en trips? (rowsecurity debe ser true)
select relname, relrowsecurity
from pg_class
where oid = 'public.trips'::regclass;

-- ---------------------------------------------------------------------------
-- PASO 2. Función espejo para ver a quién ve la DB desde la APP.  (caso A)
--   La creamos aquí y la llamamos desde el código (ver instrucciones).
--   Ojo: llamarla desde este SQL Editor devuelve null/postgres, porque aquí
--   NO eres tu usuario. Hay que llamarla desde la app con la sesión.
-- ---------------------------------------------------------------------------
create or replace function public.debug_whoami()
returns json
language sql
stable
as $$
  select json_build_object(
    'uid',  auth.uid(),
    'role', current_setting('role', true),
    'jwt_role', current_setting('request.jwt.claim.role', true)
  );
$$;

grant execute on function public.debug_whoami() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- PASO 3. Policies de trips CON la columna permissive.
--   Una policy 'RESTRICTIVE' se aplica en AND con las demás: aunque tu INSERT
--   permissive pase, si una restrictive falla, se rechaza el INSERT.
--   Espera: todas 'PERMISSIVE'. Si aparece alguna 'RESTRICTIVE' → ahí está.
-- ---------------------------------------------------------------------------
select policyname, cmd, permissive, roles, with_check
from pg_policies
where schemaname = 'public' and tablename = 'trips'
order by permissive, cmd;

-- ---------------------------------------------------------------------------
-- PASO 4. Triggers sobre trips.
--   El WITH CHECK se evalúa sobre la fila DESPUÉS de los BEFORE INSERT.
--   Un BEFORE INSERT que cambie organizer_id rompería el check aunque el
--   payload sea correcto. Espera solo: trips_set_updated_at (BEFORE UPDATE)
--   y on_trip_created (AFTER INSERT). Cualquier BEFORE INSERT extra = sospechoso.
-- ---------------------------------------------------------------------------
select tgname,
       case when tgtype & 2  = 2  then 'BEFORE' else 'AFTER' end as timing,
       case when tgtype & 4  = 4  then 'INSERT' else '' end
     || case when tgtype & 16 = 16 then ' UPDATE' else '' end
     || case when tgtype & 8  = 8  then ' DELETE' else '' end as events,
       pg_get_functiondef(tgfoid) as function_def
from pg_trigger
where tgrelid = 'public.trips'::regclass and not tgisinternal
order by timing, tgname;
