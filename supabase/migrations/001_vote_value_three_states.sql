-- =============================================================================
-- Migración 001 — vote_value pasa de 2 a 3 estados
--   antes: 'up' | 'down'
--   ahora: 'for' | 'abstain' | 'against'   (a favor | abstención | en contra)
--
-- Nombres en el mismo estilo que el resto de enums del schema (category_stance
-- usa 'favorite'/'neutral'/'hated'): valores en inglés, en minúscula.
--
-- Postgres no deja renombrar ni quitar valores de un enum en uso, así que se
-- crea uno nuevo y se reconvierte la columna. Los votos que ya existieran se
-- mapean up→for, down→against. Idempotente no es: EJECUTAR UNA SOLA VEZ.
-- =============================================================================

begin;

-- 1. Aparta el tipo viejo.
alter type public.vote_value rename to vote_value_old;

-- 2. Crea el nuevo con los 3 estados.
create type public.vote_value as enum ('for', 'abstain', 'against');

-- 3. Reconvierte votes.value mapeando los valores antiguos.
--    (votes no tiene default sobre esta columna, así que no hay que quitarlo.)
alter table public.votes
  alter column value type public.vote_value
  using (
    case value::text
      when 'up'   then 'for'
      when 'down' then 'against'
      else 'abstain'
    end
  )::public.vote_value;

-- 4. Tira el tipo viejo, ya sin referencias.
drop type public.vote_value_old;

commit;

-- Nada más depende de vote_value: ninguna función ni policy lo referencia
-- (las policies de `votes` filtran por user_id/participante, no por el valor).
