-- =============================================================================
-- Migración 004 — bloqueo real de preferences tras confirmar
--
-- Gap encontrado: las policies de UPDATE en preferences y de "for all" en
-- preference_categories solo comprueban user_id = auth.uid(). Ninguna mira
-- submitted_at. Resultado: la UI puede deshabilitar el formulario, pero nada
-- impide que el mismo usuario siga escribiendo esas filas via API directa
-- (curl, devtools) después de confirmar. El bloqueo pedido ("no puede seguir
-- editando") no existía a nivel de datos, solo de interfaz.
--
-- Fix: trigger BEFORE UPDATE/INSERT/DELETE que rechaza cualquier escritura
-- una vez submitted_at ya está puesto. La propia transición null -> now()
-- sigue funcionando porque el trigger mira OLD.submitted_at (que en ese
-- instante todavía es null).
--
-- Nota para el futuro "reabrir ronda" (fuera de alcance hoy): esa función
-- tendrá que poner submitted_at = null vía una vía que journee el trigger, p.
-- ej. una función SECURITY DEFINER que haga
-- `set local pactify.bypass_lock = 'on'` antes del UPDATE, y el trigger
-- comprobando `current_setting('pactify.bypass_lock', true) = 'on'`. No lo
-- añado ahora porque no toca construirlo hoy.
--
-- Ejecutar una vez en el SQL Editor. Idempotente.
-- =============================================================================

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

-- preference_categories no tiene su propia columna submitted_at: mira la de
-- su preferences padre.
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
