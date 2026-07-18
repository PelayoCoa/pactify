'use client';

import { useMemo, useState } from 'react';

import { ItineraryMap } from '@/components/itinerary/itinerary-map';
import { dayColor } from '@/lib/day-colors';

export type ItineraryActivityView = {
  id: string;
  dayNumber: number;
  position: number;
  title: string;
  description: string | null;
  placeName: string | null;
  startTime: string | null;
  estimatedCost: number | null;
  categoryEmoji: string | null;
  categoryLabel: string | null;
  /** null = no tiene coordenadas válidas: se ve en la lista, no en el mapa. */
  lat: number | null;
  lon: number | null;
  /** Más votos en contra que a favor. */
  rejected: boolean;
};

export function ItineraryMapView({
  activities,
  finalized,
}: {
  activities: ItineraryActivityView[];
  /** true = viaje 'finalized': las rechazadas se ocultan del todo, no solo se marcan. */
  finalized: boolean;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // En votación se ve el panorama completo (con las rechazadas marcadas, no
  // ocultas) para que el grupo decida con toda la información. Una vez
  // finalizado, las rechazadas desaparecen de esta vista -mapa y lista- sin
  // tocar la fila en la BD: siguen ahí para quien mire itinerary_activities
  // directamente, solo dejan de mostrarse aquí.
  const visibleActivities = useMemo(
    () => (finalized ? activities.filter((a) => !a.rejected) : activities),
    [activities, finalized],
  );

  const days = useMemo(() => {
    const map = new Map<number, ItineraryActivityView[]>();
    for (const a of visibleActivities) {
      const list = map.get(a.dayNumber) ?? [];
      list.push(a);
      map.set(a.dayNumber, list);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [visibleActivities]);

  const mapActivities = useMemo(
    () =>
      visibleActivities
        .filter(
          (a): a is ItineraryActivityView & { lat: number; lon: number } =>
            a.lat != null &&
            a.lon != null &&
            a.lat >= -90 &&
            a.lat <= 90 &&
            a.lon >= -180 &&
            a.lon <= 180,
        )
        .map((a) => ({
          id: a.id,
          dayNumber: a.dayNumber,
          title: a.title,
          placeName: a.placeName,
          lat: a.lat,
          lon: a.lon,
          rejected: a.rejected,
        })),
    [visibleActivities],
  );

  const skippedCount = visibleActivities.length - mapActivities.length;

  return (
    <div className="flex flex-col gap-4">
      <ItineraryMap activities={mapActivities} selectedDay={selectedDay} />

      {skippedCount > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {skippedCount} {skippedCount === 1 ? 'actividad no tiene' : 'actividades no tienen'}{' '}
          ubicación válida y no {skippedCount === 1 ? 'aparece' : 'aparecen'} en el mapa.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedDay(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            selectedDay === null
              ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
              : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
          }`}
        >
          Todos los días
        </button>
        {days.map(([day]) => (
          <button
            key={day}
            type="button"
            onClick={() => setSelectedDay(selectedDay === day ? null : day)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              selectedDay === day ? 'text-white' : 'text-neutral-700 hover:opacity-80 dark:text-neutral-200'
            }`}
            style={{
              borderColor: dayColor(day),
              backgroundColor: selectedDay === day ? dayColor(day) : 'transparent',
            }}
          >
            Día {day}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {days.map(([day, dayActivities]) => (
          <div
            key={day}
            className={`space-y-2 rounded-xl border p-3 transition ${
              selectedDay !== null && selectedDay !== day
                ? 'border-neutral-100 opacity-40 dark:border-neutral-900'
                : 'border-neutral-200 dark:border-neutral-800'
            }`}
          >
            <h3
              className="text-sm font-medium"
              style={{ color: selectedDay === day ? dayColor(day) : undefined }}
            >
              Día {day}
            </h3>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {dayActivities
                .sort((a, b) => a.position - b.position)
                .map((a) => (
                  <li
                    key={a.id}
                    className={`py-2 ${
                      a.rejected
                        ? 'border-l-2 border-l-red-500 pl-2 opacity-60'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {a.categoryEmoji} {a.title}
                      </p>
                      {a.rejected && (
                        <span className="badge bg-red-100 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          Más votos en contra
                        </span>
                      )}
                    </div>
                    {a.placeName && <p className="text-xs text-neutral-400">{a.placeName}</p>}
                    {a.description && (
                      <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
                        {a.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {a.startTime?.slice(0, 5)}
                      {a.estimatedCost != null ? ` · ${a.estimatedCost} €/persona` : ''}
                      {(a.lat == null || a.lon == null) && ' · sin ubicación en el mapa'}
                    </p>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
