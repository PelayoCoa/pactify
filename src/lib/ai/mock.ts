import type { ItineraryResponse } from '@/lib/ai/itinerary-schema';
import type { TripContext } from '@/lib/ai/prompt';

/**
 * Mock de la respuesta de Claude. MISMA estructura exacta que la real
 * (ItineraryResponse), para que la UI que lo consume no note la diferencia.
 *
 * No es un JSON congelado: se construye a partir del contexto real del viaje
 * (días, categorías del catálogo, nombres reales de participantes, destinos
 * propuestos). Si fuese estático se colaría basura en la BD —por ejemplo
 * actividades del día 5 en un viaje de 3 días— y el validador la rechazaría,
 * que es justo lo contrario de lo que quieres mientras montas la interfaz.
 */
export function buildMockItinerary(ctx: TripContext): ItineraryResponse {
  const names = ctx.participants.map((p) => p.name);
  const first = names[0] ?? 'Alguien';
  const second = names[1] ?? first;

  const destination = ctx.proposals[0]?.name ?? 'Lisboa, Portugal';
  const baseLat = ctx.proposals[0]?.lat ?? 38.7223;
  const baseLon = ctx.proposals[0]?.lon ?? -9.1393;

  const slugs = ctx.categories.map((c) => c.slug);
  const pick = (i: number) => slugs[i % slugs.length] ?? 'food';

  const activities: ItineraryResponse['activities'] = [];
  for (let day = 1; day <= ctx.days; day++) {
    const perDay = 3;
    for (let pos = 0; pos < perDay; pos++) {
      const n = (day - 1) * perDay + pos;
      activities.push({
        day_number: day,
        position: pos,
        title: `[MOCK] Actividad ${pos + 1} del día ${day}`,
        description:
          'Datos de ejemplo generados sin llamar a la API de Claude (USE_MOCK_AI=true).',
        category_slug: pick(n),
        start_time: ['10:00', '14:00', '19:00'][pos] ?? '12:00',
        duration_min: [120, 90, 150][pos] ?? 60,
        estimated_cost: [12, 0, 25][pos] ?? 10,
        place_name: `[MOCK] Sitio ${n + 1}`,
        address: `Calle Falsa ${n + 1}, ${destination}`,
        // Desplazamiento pequeño para que los pines no se apilen en el mapa.
        lat: Number((baseLat + n * 0.004).toFixed(6)),
        lon: Number((baseLon + n * 0.004).toFixed(6)),
      });
    }
  }

  const conflicts: ItineraryResponse['conflicts'] = [
    {
      kind: 'category',
      summary: `[MOCK] ${first} y ${second} chocan en una categoría del checklist.`,
      resolution:
        '[MOCK] Explicación de ejemplo. En la generación real esto cita nombres, categorías e importes concretos de las preferencias.',
      affected_participants: [first, second].filter((v, i, a) => a.indexOf(v) === i),
    },
    {
      kind: 'budget',
      summary: `[MOCK] Una actividad no encaja en el presupuesto de ${first}.`,
      resolution:
        '[MOCK] Explicación de ejemplo. En la real aquí van los euros reales de cada participante.',
      affected_participants: [first],
    },
  ];

  // Si es una regeneración, añade un conflicto de empate de ejemplo — así se
  // puede probar esa parte de la UI sin gastar una llamada real.
  const tiedActivity = ctx.regeneration?.activities.find((a) => a.isTie);
  if (tiedActivity) {
    conflicts.push({
      kind: 'vote_tie',
      summary: `[MOCK] "${tiedActivity.title}" quedó empatada: ${tiedActivity.votesFor} a favor / ${tiedActivity.votesAgainst} en contra.`,
      resolution:
        '[MOCK] Explicación de ejemplo de cómo se resolvió el empate. En la real, la IA decide y lo justifica con los votos reales.',
      affected_participants: [first],
    });
  }

  return {
    destination,
    destination_reason:
      '[MOCK] Motivo de ejemplo. En la generación real compara las propuestas reales del grupo.',
    activities,
    conflicts,
  };
}
