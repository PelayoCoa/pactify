'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { addDestinationProposal } from '@/app/trips/[id]/destinations/actions';
import { useToast } from '@/components/ui/toast-provider';
import { searchPlaces, GeocodingError, type GeocodeResult } from '@/lib/geocoding';

const DEBOUNCE_MS = 350;

export function DestinationSearch({ tripId }: { tripId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [notes, setNotes] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected) return; // ya se eligió uno: no seguir buscando
    if (query.trim().length < 3) {
      setResults([]);
      setSearchError(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const found = await searchPlaces(query.trim());
        setResults(found);
        if (found.length === 0) setSearchError('No se encontraron lugares para esa búsqueda.');
      } catch (e) {
        setResults([]);
        setSearchError(e instanceof GeocodingError ? e.message : 'Error buscando el lugar.');
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, selected]);

  function pick(result: GeocodeResult) {
    setSelected(result);
    setResults([]);
  }

  function reset() {
    setSelected(null);
    setQuery('');
    setNotes('');
    setSaveError(null);
  }

  function onAdd() {
    if (!selected) return;
    startTransition(async () => {
      const result = await addDestinationProposal({
        tripId,
        name: selected.name,
        country: selected.country,
        notes: notes.trim() === '' ? null : notes.trim(),
        lat: selected.lat,
        lon: selected.lon,
      });
      if (result.ok) {
        reset();
        showToast('Destino propuesto.', 'success');
      } else {
        setSaveError(result.error);
        showToast(result.error, 'error');
      }
    });
  }

  return (
    <div className="card flex flex-col gap-2 p-4">
      <label htmlFor="dest-search" className="text-sm font-medium">
        Proponer un destino
      </label>

      {!selected ? (
        <div className="relative">
          <input
            id="dest-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca un museo, playa, restaurante…"
            className="field"
          />
          {searching && (
            <p className="mt-1 text-xs text-neutral-400">Buscando…</p>
          )}
          {searchError && !searching && (
            <p className="mt-1 text-xs text-neutral-500">{searchError}</p>
          )}
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-md dark:border-neutral-700 dark:bg-neutral-900">
              {results.map((r, i) => (
                <li key={`${r.name}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2 rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
            <span>{selected.name}</span>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 text-xs text-neutral-500 hover:underline"
            >
              Cambiar
            </button>
          </div>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="¿Por qué te interesa? (opcional)"
            className="field resize-none"
          />
          <button
            type="button"
            disabled={pending}
            onClick={onAdd}
            className="btn-primary self-start"
          >
            {pending ? 'Añadiendo…' : 'Añadir propuesta'}
          </button>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        </div>
      )}
    </div>
  );
}
