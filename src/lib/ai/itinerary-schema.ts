import { z } from 'zod';

/**
 * Contrato de la respuesta de la IA.
 *
 * Se usa en dos sitios y tiene que ser el MISMO en los dos:
 *   1. Como structured output de Claude (zodOutputFormat) → la API garantiza
 *      que el JSON valida contra este esquema.
 *   2. Como forma del mock (USE_MOCK_AI=true) → mismo shape exacto, para que
 *      la UI que lo consume no note la diferencia.
 *
 * Nota de límites del esquema JSON de structured outputs: no admite
 * `minimum`/`maximum`/`minLength`, así que los rangos numéricos NO se pueden
 * forzar desde aquí. Se validan a mano en validateAgainstTrip() más abajo.
 */

export const ActivitySchema = z.object({
  day_number: z.number().int().describe('Día del viaje, empezando en 1.'),
  position: z.number().int().describe('Orden dentro del día, empezando en 0.'),
  title: z.string().describe('Nombre corto de la actividad.'),
  description: z.string().describe('Qué se hace y por qué encaja con el grupo.'),
  category_slug: z
    .string()
    .describe('Slug de una de las categorías del catálogo que se te pasa.'),
  start_time: z
    .string()
    .describe('Hora de inicio en formato HH:MM de 24h. Cadena vacía si no aplica.'),
  duration_min: z.number().int().describe('Duración estimada en minutos.'),
  estimated_cost: z
    .number()
    .describe('Coste estimado POR PERSONA en EUR. 0 si es gratis.'),
  place_name: z.string().describe('Nombre del sitio concreto.'),
  address: z.string().describe('Dirección aproximada. Cadena vacía si no la sabes.'),
  lat: z.number().describe('Latitud del sitio.'),
  lon: z.number().describe('Longitud del sitio.'),
});

export const ConflictSchema = z.object({
  kind: z
    .enum(['category', 'budget', 'veto', 'destination', 'schedule', 'vote_tie'])
    .describe(
      'Tipo de choque que has resuelto. "vote_tie" es solo para regeneraciones: una actividad con votos empatados a favor/en contra.',
    ),
  summary: z.string().describe('El choque en una frase, nombrando a quién afecta.'),
  resolution: z
    .string()
    .describe('Qué decidiste y por qué, citando los datos concretos.'),
  affected_participants: z
    .array(z.string())
    .describe('Nombres de los participantes implicados en el choque.'),
});

export const ItineraryResponseSchema = z.object({
  destination: z
    .string()
    .describe('El destino elegido entre los propuestos por el grupo.'),
  destination_reason: z
    .string()
    .describe('Por qué ese destino y no los otros, con datos concretos.'),
  activities: z.array(ActivitySchema),
  conflicts: z.array(ConflictSchema),
});

export type Activity = z.infer<typeof ActivitySchema>;
export type Conflict = z.infer<typeof ConflictSchema>;
export type ItineraryResponse = z.infer<typeof ItineraryResponseSchema>;

/**
 * Lee itinerary_versions.raw_response.conflicts -jsonb sin tipar en la BD-.
 * Compartida entre el panel interactivo y el documento del PDF: misma forma
 * exacta en los dos sitios. Degrada con gracia: cualquier forma inesperada
 * (o una versión antigua con otro formato) devuelve lista vacía en vez de
 * reventar la pantalla.
 */
export function extractConflicts(raw: unknown): Conflict[] {
  if (!raw || typeof raw !== 'object' || !('conflicts' in raw)) return [];
  const list = (raw as { conflicts?: unknown }).conflicts;
  if (!Array.isArray(list)) return [];

  return list.filter((c): c is Conflict => {
    return (
      !!c &&
      typeof c === 'object' &&
      typeof (c as Conflict).kind === 'string' &&
      typeof (c as Conflict).summary === 'string' &&
      typeof (c as Conflict).resolution === 'string'
    );
  });
}

/** Error de dominio: la respuesta llegó pero no encaja con la realidad del viaje. */
export class ItineraryValidationError extends Error {}

/**
 * Validaciones que el esquema JSON NO puede expresar y la BD tampoco.
 *
 * Concretamente `day_number`: la tabla solo tiene `check (day_number >= 1)`,
 * sin techo, porque un CHECK no puede mirar `trips.days` (está en otra tabla).
 * Si Claude devuelve el día 7 de un viaje de 3 días, Postgres lo aceptaría
 * tan contento. Este es el único sitio donde se puede cazar.
 */
export function validateAgainstTrip(
  data: ItineraryResponse,
  opts: { days: number; categorySlugs: Set<string> },
): void {
  if (data.activities.length === 0) {
    throw new ItineraryValidationError('La IA no devolvió ninguna actividad.');
  }

  for (const a of data.activities) {
    if (a.day_number < 1 || a.day_number > opts.days) {
      throw new ItineraryValidationError(
        `Actividad "${a.title}" en el día ${a.day_number}, pero el viaje dura ${opts.days} días.`,
      );
    }
    if (!opts.categorySlugs.has(a.category_slug)) {
      throw new ItineraryValidationError(
        `Actividad "${a.title}" usa la categoría "${a.category_slug}", que no está en el catálogo.`,
      );
    }
    if (a.lat < -90 || a.lat > 90 || a.lon < -180 || a.lon > 180) {
      throw new ItineraryValidationError(
        `Actividad "${a.title}" tiene coordenadas fuera de rango (${a.lat}, ${a.lon}).`,
      );
    }
    if (a.estimated_cost < 0) {
      throw new ItineraryValidationError(
        `Actividad "${a.title}" tiene un coste negativo.`,
      );
    }
    if (a.duration_min <= 0) {
      throw new ItineraryValidationError(
        `Actividad "${a.title}" tiene una duración no positiva.`,
      );
    }
    if (a.start_time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.start_time)) {
      throw new ItineraryValidationError(
        `Actividad "${a.title}" tiene una hora inválida: "${a.start_time}".`,
      );
    }
  }

  // unique (version_id, day_number, position) en la tabla: si Claude repite un
  // (día, position) el insert entero revienta. Mejor cazarlo aquí y decirlo claro.
  const seen = new Set<string>();
  for (const a of data.activities) {
    const key = `${a.day_number}:${a.position}`;
    if (seen.has(key)) {
      throw new ItineraryValidationError(
        `Hay dos actividades en el día ${a.day_number}, posición ${a.position}.`,
      );
    }
    seen.add(key);
  }
}
