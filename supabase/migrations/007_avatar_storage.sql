-- =============================================================================
-- Migración 007 — bucket de Storage para fotos de perfil
--
-- `profiles.avatar_url` existe en el schema desde el principio pero nunca se
-- ha escrito en ella desde la app: no había ningún sitio donde guardar el
-- archivo. Esta migración crea ese sitio.
--
-- Bucket público (`public = true`): el mismo criterio que ya usa la policy de
-- SELECT de `profiles` ("perfiles visibles para usuarios autenticados" -
-- cualquier participante puede ver el nombre de cualquier otro-). Una foto de
-- perfil no es información sensible en este contexto, así que servirla por
-- URL pública directa (sin URLs firmadas) es coherente con esa misma decisión,
-- no un relajamiento nuevo de seguridad.
--
-- Lo que SÍ sigue protegido con RLS de verdad es la ESCRITURA: cada usuario
-- solo puede insertar/reemplazar/borrar objetos dentro de su propia carpeta
-- `{user_id}/...` -exactamente el mismo patrón "id = auth.uid()" que ya usa
-- la policy de UPDATE de `profiles`-. `storage.foldername(name)` devuelve el
-- path partido en segmentos; el primero es el user_id porque así es como la
-- app sube los archivos (ver `updateAvatar` en profile/actions.ts).
--
-- Límite de tamaño (2 MB) y de tipo (solo imágenes) puestos también aquí, a
-- nivel de bucket, como defensa en profundidad: la app ya valida esto mismo
-- antes de subir, pero si algo se saltara esa validación, Storage lo rechaza
-- igualmente.
--
-- Ejecutar una vez en el SQL Editor. Idempotente.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar propio: subir" on storage.objects;
create policy "avatar propio: subir"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar propio: reemplazar" on storage.objects;
create policy "avatar propio: reemplazar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar propio: borrar" on storage.objects;
create policy "avatar propio: borrar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatares visibles para todos" on storage.objects;
create policy "avatares visibles para todos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');
