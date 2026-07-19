-- =============================================================================
-- Migración 010 — alfabeto sin caracteres ambiguos para el código de invitación
--
-- HALLAZGO: generate_invite_code() sacaba 6 caracteres hexadecimales
-- (upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 6))), es
-- decir del alfabeto 0123456789ABCDEF. Dentro de ESE alfabeto hay una
-- colisión real: el dígito 8 y la letra B pueden aparecer en el mismo código
-- y se confunden fácilmente a mano. Los dígitos 0 y 1 también aparecen -sin
-- que O/I/L convivan con ellos en este alfabeto concreto, pero siguen siendo
-- los caracteres clásicamente ambiguos al escribir un código sin saber que
-- está restringido a hexadecimal-.
--
-- FIX: alfabeto de 32 símbolos sin 0, O, 1, I, L (el mismo criterio que usa
-- Crockford's Base32 y la mayoría de códigos pensados para transcribirse a
-- mano). De propina, 32^6 (~1073 millones) tiene muchísima más entropía que
-- el hexadecimal anterior (16^6, ~16.7 millones).
--
-- Los códigos YA EXISTENTES no se tocan -son texto ya guardado en
-- trips.invite_code, ajeno a cómo se generen los nuevos-. Esto solo cambia
-- qué alfabeto usan los códigos que se generen a partir de ahora.
--
-- Ejecutar una vez en el SQL Editor. Idempotente.
-- =============================================================================

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  -- Sin 0, O, 1, I, L: nada que se confunda escribiéndolo a mano.
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  alen int := length(alphabet);
  raw bytea := gen_random_bytes(6);
  result text := '';
  i int;
begin
  for i in 0..5 loop
    -- 256 (rango de un byte) es múltiplo exacto de 32: el módulo no sesga
    -- ningún carácter del alfabeto.
    result := result || substr(alphabet, 1 + (get_byte(raw, i) % alen), 1);
  end loop;
  return result;
end;
$$;
