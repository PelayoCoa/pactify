/** Compartido entre la foto de perfil y la foto de grupo del viaje. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Extrae el path dentro de un bucket a partir de la URL pública que devuelve Supabase Storage. */
export function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}
