import { extractConflicts } from '@/lib/ai/itinerary-schema';

const KIND_LABEL: Record<string, string> = {
  category: 'Categoría',
  budget: 'Presupuesto',
  veto: 'Veto',
  destination: 'Destino',
  schedule: 'Horario',
  vote_tie: 'Empate en la votación',
};

/**
 * Cuenta y lista los conflictos que la IA ya resolvió, leyendo directamente
 * de itinerary_versions.raw_response.conflicts — no inventa estructura nueva.
 *
 * `raw_response` es jsonb sin tipar en la BD: si algún día cambia el formato
 * (o es una versión antigua con otra forma), esto no debe romper la pantalla,
 * solo dejar de mostrar nada.
 */
export function ConflictsPanel({ raw }: { raw: unknown }) {
  const conflicts = extractConflicts(raw);
  if (conflicts.length === 0) return null;

  return (
    <details className="rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      <summary className="cursor-pointer font-medium">
        {conflicts.length} {conflicts.length === 1 ? 'conflicto resuelto' : 'conflictos resueltos'}{' '}
        por la IA
      </summary>
      <ul className="mt-3 space-y-3">
        {conflicts.map((c, i) => (
          <li
            key={i}
            className="border-t border-neutral-100 pt-3 first:border-0 first:pt-0 dark:border-neutral-800"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              {KIND_LABEL[c.kind] ?? c.kind}
            </p>
            <p className="mt-0.5">{c.summary}</p>
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">{c.resolution}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
