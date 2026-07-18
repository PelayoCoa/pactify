export type ProfileLite = {
  display_name: string | null;
  email: string;
  avatar_url?: string | null;
} | null;

/**
 * Nombre a mostrar de un perfil. Usado en toda la app para no repetir esta
 * lógica en cada pantalla.
 *
 * El perfil llega `null` en dos casos: (1) el join no encontró fila —no
 * debería pasar en la práctica, todo participante tiene perfil desde que se
 * registra—, o (2) la cuenta se borró y el FK de la fila (voto, propuesta)
 * quedó en null a propósito para conservar el dato anonimizado. En ambos
 * casos "Usuario eliminado" es la lectura correcta: aquí nunca hay un
 * "invitado sin perfil" real, así que si no hay perfil, es que ya no existe.
 */
export function nameOf(p: ProfileLite): string {
  return p?.display_name ?? p?.email?.split('@')[0] ?? 'Usuario eliminado';
}
