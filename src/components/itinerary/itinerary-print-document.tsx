import type { ItineraryActivityView } from '@/components/itinerary/itinerary-map-view';
import type { Conflict } from '@/lib/ai/itinerary-schema';

const KIND_LABEL: Record<string, string> = {
  category: 'Categoría',
  budget: 'Presupuesto',
  veto: 'Veto',
  destination: 'Destino',
  schedule: 'Horario',
  vote_tie: 'Empate en la votación',
};

/**
 * Documento de texto/lista para imprimir o guardar como PDF -no el mapa
 * interactivo-. A propósito SIN clases dark: aquí: un PDF siempre se lee
 * sobre fondo blanco, imprimirlo en oscuro no tendría sentido aunque el resto
 * de la app respete el tema del sistema.
 *
 * `conflicts` es opcional a propósito: `summary`/`resolution` son texto libre
 * que el prompt le pide a la IA escribir "citando nombres... e importes
 * reales" de los participantes -son solo lectura interna, para el grupo, no
 * para cualquiera-. El caller de /share/[tripId]/pdf (público, sin login) NO
 * debe pasar este prop; solo el PDF autenticado de dentro de la app, donde
 * los participantes ya se conocen entre sí.
 */
export function ItineraryPrintDocument({
  tripTitle,
  destination,
  activities,
  conflicts = [],
  isMock,
}: {
  tripTitle: string;
  destination: string | null;
  activities: ItineraryActivityView[];
  conflicts?: Conflict[];
  isMock: boolean;
}) {
  const days = new Map<number, ItineraryActivityView[]>();
  for (const a of activities) {
    const list = days.get(a.dayNumber) ?? [];
    list.push(a);
    days.set(a.dayNumber, list);
  }
  const sortedDays = [...days.entries()].sort(([a], [b]) => a - b);

  return (
    <article className="flex flex-col gap-6 bg-white text-neutral-900">
      <header className="space-y-1 border-b border-neutral-300 pb-4">
        <h1 className="text-2xl font-semibold">{tripTitle}</h1>
        {destination && <p className="text-sm text-neutral-600">{destination}</p>}
        {isMock && (
          <p className="mt-1 inline-block rounded border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            Datos de ejemplo (modo mock) — no es una llamada real a la IA
          </p>
        )}
      </header>

      {sortedDays.map(([day, dayActivities]) => (
        <section key={day} className="space-y-2 break-inside-avoid">
          <h2 className="text-lg font-semibold">Día {day}</h2>
          <ol className="space-y-3">
            {dayActivities
              .sort((a, b) => a.position - b.position)
              .map((a) => (
                <li key={a.id} className="border-b border-neutral-100 pb-2 last:border-0">
                  <p className="font-medium">
                    {a.startTime ? `${a.startTime.slice(0, 5)} — ` : ''}
                    {a.title}
                  </p>
                  {a.placeName && <p className="text-sm text-neutral-600">{a.placeName}</p>}
                  {a.description && (
                    <p className="mt-0.5 text-sm text-neutral-700">{a.description}</p>
                  )}
                  {a.estimatedCost != null && (
                    <p className="mt-0.5 text-xs text-neutral-500">{a.estimatedCost} €/persona</p>
                  )}
                </li>
              ))}
          </ol>
        </section>
      ))}

      {conflicts.length > 0 && (
        <section className="space-y-2 border-t border-neutral-300 pt-4 break-inside-avoid">
          <h2 className="text-lg font-semibold">Conflictos resueltos por la IA</h2>
          <ol className="space-y-3">
            {conflicts.map((c, i) => (
              <li key={i} className="text-sm">
                <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
                  {KIND_LABEL[c.kind] ?? c.kind}
                </p>
                <p>{c.summary}</p>
                <p className="text-neutral-600">{c.resolution}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
