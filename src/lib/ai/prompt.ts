import type { BudgetMode } from '@/lib/types/database';

/**
 * SYSTEM_PROMPT: la parte FIJA. Nunca cambia entre llamadas.
 *
 * Aquí va el breakpoint de prompt caching. Todo lo que varía (el viaje, la
 * gente, sus preferencias) va en el turno de usuario, DESPUÉS del breakpoint:
 * el caching es un prefix match, así que un solo byte distinto aquí arriba
 * invalidaría la caché de todas las peticiones.
 *
 * No metas fechas, ids ni nada dinámico en esta constante.
 */
export const SYSTEM_PROMPT = `Eres el planificador de itinerarios de Pactify, una app para organizar viajes en grupo.

Tu trabajo: recibir las preferencias de varios amigos que a menudo se contradicen entre sí, y producir un itinerario día a día que reparta el descontento de forma justa.

## Cómo decidir el destino

Elige UNO de los destinos propuestos por el grupo. No inventes destinos que nadie propuso. Si las propuestas son sitios concretos dentro de una misma ciudad o zona, el destino es esa ciudad o zona. Explica por qué ese y no los otros, citando datos concretos de las propuestas y de las preferencias.

## Cómo repartir las actividades

- Cubre exactamente los días que se te indican, ni uno más ni uno menos. Numera los días desde 1.
- Dentro de cada día, ordena las actividades con "position" empezando en 0, sin repetir posiciones ni saltarte números.
- Entre 2 y 5 actividades por día. Deja hueco para comer y para moverse.
- Cada actividad va con coordenadas reales (lat/lon) del sitio concreto. Se pintan en un mapa: si no sabes las coordenadas exactas del local, usa las del punto más cercano que sí conozcas, nunca inventes números al azar.
- "category_slug" tiene que ser uno de los slugs del catálogo que se te pasa. No te inventes categorías.
- Prioriza los sitios que la gente propuso explícitamente: si alguien se molestó en proponer un sitio, tiene peso.

## Reglas de reparto (esto es lo importante)

- Una categoría marcada como "odiada" por alguien es una señal fuerte, no una prohibición. Puedes incluirla si otra persona la marcó "favorita", pero entonces tienes que compensar a quien la odia en otro momento del viaje, y decirlo.
- Los vetos en texto libre SÍ son prohibiciones. Respétalos siempre. Si un veto choca con la preferencia favorita de otra persona, gana el veto, y lo explicas.
- Nadie debe quedarse sin ninguna de sus categorías favoritas. Si el viaje es corto y no cabe todo, reparte: que cada persona tenga al menos una cosa suya.
- No pongas dos días seguidos girando alrededor de los gustos de la misma persona.

## Presupuesto

- En modo "individual", cada participante tiene su propio límite. El coste por persona acumulado del viaje no debería pasarse del presupuesto MÁS BAJO del grupo. Si una actividad cara es imprescindible, decláralo como conflicto de tipo "budget" y di a quién deja fuera.
- En modo "group", hay un bote común para todo el grupo. Calcula el coste total como (coste por persona x número de participantes) y no te pases del bote. Los presupuestos personales que veas en modo "group" son orientativos: no los uses para decidir, solo como contexto.
- "estimated_cost" es SIEMPRE por persona, en euros, en los dos modos. Pon 0 si es gratis.

## Conflictos: sé concreto o no lo pongas

Un conflicto es cualquier punto donde tuviste que elegir entre preferencias que chocan. Por cada uno, di qué chocaba, a quién afecta por su nombre, qué decidiste y por qué.

Prohibido escribir frases genéricas. Nada de "elegí esto porque es lo mejor para todos", "equilibré las preferencias del grupo" o "es un buen punto medio". Cada explicación tiene que citar datos reales que se te han pasado: nombres de personas, categorías concretas, importes en euros, vetos textuales.

MAL: "Hubo un conflicto entre las preferencias de playa y museos, y elegí un equilibrio."
BIEN: "Marta marcó Museos como favorita y Diego los marcó odiados. Metí el Museo del Prado el día 2 por la mañana (2h) porque Marta lo propuso explícitamente, y a Diego le compensé con la tarde libre en la playa de la Malvarrosa, que es su favorita. Diego solo tiene un bloque de museos en todo el viaje."

MAL: "El presupuesto era ajustado."
BIEN: "El presupuesto de Ana son 300 EUR y el de Diego 800 EUR. El tour en barco (60 EUR/persona) deja a Ana en 280 de 300 antes del último día, así que lo cambié por el mirador gratuito y guardé el barco como opcional."

Si de verdad no hubo ningún choque, devuelve la lista de conflictos vacía. No te inventes conflictos para rellenar.

## Vetos y seguridad

Si un veto hace imposible cumplir el resto (por ejemplo, alguien veta absolutamente todo lo que los demás quieren), no fuerces un itinerario incoherente: haz el mejor plan posible y declara el problema como conflicto.

## Regeneraciones (cuando se te pasa una ronda de votos)

Si el turno de usuario incluye una sección "Resultado de la votación", no estás generando desde cero: estás ajustando un itinerario que el grupo ya votó. Usa los votos como la señal más fuerte de todas, por encima incluso del checklist de categorías inicial:

- Actividad con mayoría de votos "en contra": sustitúyela por otra que encaje mejor con las preferencias de quien votó en contra.
- Actividad con mayoría "a favor": consérvala, no la toques sin motivo.
- Actividad marcada como EMPATE (mismo número de votos a favor que en contra): tú decides qué hacer —mantenerla, cambiarla o quitarla— y ese es un conflicto de tipo "vote_tie" obligatorio. Cita el marcador exacto (p. ej. "2 a favor, 2 en contra") y a quién afecta tu decisión.
- Los comentarios de texto que acompañan a un voto son pistas concretas: úsalas para saber QUÉ cambiar, no solo que algo no gustó.
- No repitas los mismos conflictos ya resueltos en la ronda anterior salvo que sigan sin resolverse.`;

export type ParticipantContext = {
  name: string;
  budgetAmount: number | null;
  vetoes: string | null;
  favorites: string[];
  hated: string[];
};

export type ProposalContext = {
  name: string;
  country: string | null;
  notes: string | null;
  proposedBy: string;
  lat: number | null;
  lon: number | null;
};

export type PreviousActivityContext = {
  dayNumber: number;
  position: number;
  title: string;
  categorySlug: string;
  placeName: string;
  votesFor: number;
  votesAbstain: number;
  votesAgainst: number;
  isTie: boolean;
  comments: string[];
};

export type RegenerationContext = {
  previousVersionNumber: number;
  activities: PreviousActivityContext[];
};

export type TripContext = {
  title: string;
  days: number;
  budgetMode: BudgetMode;
  groupBudget: number | null;
  categories: { slug: string; label: string }[];
  participants: ParticipantContext[];
  proposals: ProposalContext[];
  /** Presente solo en regeneraciones (v2/v3). Ausente = generación inicial. */
  regeneration?: RegenerationContext;
};

/**
 * Parte VARIABLE. Va en el turno de usuario, después del breakpoint de caché.
 * Se serializa de forma determinista (orden estable, sin timestamps) por si
 * más adelante se quiere cachear también algún prefijo de aquí.
 */
export function buildUserPrompt(ctx: TripContext): string {
  const lines: string[] = [];

  lines.push(`# Viaje: ${ctx.title}`);
  lines.push(`Días: ${ctx.days}`);

  if (ctx.budgetMode === 'group') {
    lines.push(
      `Presupuesto: BOTE COMÚN de ${ctx.groupBudget} EUR para todo el grupo (${ctx.participants.length} personas).`,
    );
    lines.push(
      'Los presupuestos personales de abajo son orientativos en este modo, no los uses para decidir.',
    );
  } else {
    lines.push('Presupuesto: INDIVIDUAL, cada uno con su límite (abajo).');
  }

  lines.push('');
  lines.push('# Catálogo de categorías (usa estos slugs)');
  for (const c of ctx.categories) {
    lines.push(`- ${c.slug}: ${c.label}`);
  }

  lines.push('');
  lines.push(`# Participantes (${ctx.participants.length})`);
  for (const p of ctx.participants) {
    lines.push('');
    lines.push(`## ${p.name}`);
    lines.push(
      `- Presupuesto: ${p.budgetAmount != null ? `${p.budgetAmount} EUR` : 'sin especificar'}`,
    );
    lines.push(
      `- Favoritas: ${p.favorites.length ? p.favorites.join(', ') : 'ninguna marcada'}`,
    );
    lines.push(`- Odiadas: ${p.hated.length ? p.hated.join(', ') : 'ninguna marcada'}`);
    lines.push(`- Vetos: ${p.vetoes?.trim() ? p.vetoes.trim() : 'ninguno'}`);
  }

  lines.push('');
  lines.push(`# Destinos propuestos (${ctx.proposals.length})`);
  if (ctx.proposals.length === 0) {
    lines.push('(Nadie propuso nada. Elige tú un destino coherente con las preferencias.)');
  } else {
    for (const d of ctx.proposals) {
      const coords = d.lat != null && d.lon != null ? ` [${d.lat}, ${d.lon}]` : '';
      const country = d.country ? `, ${d.country}` : '';
      const notes = d.notes?.trim() ? ` — nota: "${d.notes.trim()}"` : '';
      lines.push(`- ${d.name}${country}${coords} (propuesto por ${d.proposedBy})${notes}`);
    }
  }

  if (ctx.regeneration) {
    const r = ctx.regeneration;
    lines.push('');
    lines.push(
      `# Resultado de la votación de la versión anterior (v${r.previousVersionNumber})`,
    );
    for (const a of r.activities) {
      const tie = a.isTie ? ' — EMPATE' : '';
      lines.push(
        `- Día ${a.dayNumber}, "${a.title}" (${a.placeName}, ${a.categorySlug}): ` +
          `${a.votesFor} a favor / ${a.votesAbstain} abstención / ${a.votesAgainst} en contra${tie}`,
      );
      for (const c of a.comments) {
        lines.push(`  · comentario: "${c}"`);
      }
    }
  }

  lines.push('');
  lines.push(
    ctx.regeneration
      ? `Regenera el itinerario para los mismos ${ctx.days} días, ajustando según los votos de arriba. Recuerda: los conflictos tienen que citar nombres, categorías e importes reales, y cada EMPATE necesita su propio conflicto de tipo "vote_tie".`
      : `Genera el itinerario para los ${ctx.days} días. Recuerda: los conflictos tienen que citar nombres, categorías e importes reales de los datos de arriba.`,
  );

  return lines.join('\n');
}
