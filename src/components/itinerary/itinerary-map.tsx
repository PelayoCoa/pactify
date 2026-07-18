'use client';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

import { dayColor } from '@/lib/day-colors';

export type MapActivity = {
  id: string;
  dayNumber: number;
  title: string;
  placeName: string | null;
  lat: number;
  lon: number;
  /** Más votos en contra que a favor: pin con borde rojo y más tenue. */
  rejected: boolean;
};

export function ItineraryMap({
  activities,
  selectedDay,
}: {
  activities: MapActivity[];
  selectedDay: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ dayNumber: number; rejected: boolean; marker: maplibregl.Marker }[]>([]);

  // Montaje del mapa: una sola vez. `activities` ya viene filtrada por el
  // padre a las que tienen coordenadas válidas, así que aquí no hay que
  // volver a comprobar nada — si llega vacío, ni se intenta montar.
  useEffect(() => {
    if (!containerRef.current || activities.length === 0) return;

    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`,
      center: [activities[0].lon, activities[0].lat],
      zoom: 12,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const bounds = new maplibregl.LngLatBounds();
    const markers: { dayNumber: number; rejected: boolean; marker: maplibregl.Marker }[] = [];

    for (const a of activities) {
      const el = document.createElement('div');
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.borderRadius = '50%';
      // Rechazada (más en contra que a favor): borde rojo en vez de blanco,
      // para que destaque como "va perdiendo" sin dejar de verse en el mapa.
      el.style.border = a.rejected ? '2px solid #ef4444' : '2px solid white';
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
      el.style.backgroundColor = dayColor(a.dayNumber);
      el.style.cursor = 'pointer';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([a.lon, a.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 12 }).setHTML(
            `<strong>Día ${a.dayNumber}</strong>${a.rejected ? ' <span style="color:#ef4444">(más en contra)</span>' : ''}<br>${escapeHtml(a.title)}${
              a.placeName ? `<br><span style="color:#737373">${escapeHtml(a.placeName)}</span>` : ''
            }`,
          ),
        )
        .addTo(map);

      markers.push({ dayNumber: a.dayNumber, rejected: a.rejected, marker });
      bounds.extend([a.lon, a.lat]);
    }

    markersRef.current = markers;

    if (activities.length > 1) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 15 });
    }

    return () => {
      markers.forEach((m) => m.marker.remove());
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resalta solo los pines del día elegido, sin recrear el mapa. Las
  // rechazadas quedan más tenues siempre, dentro o fuera del día elegido.
  useEffect(() => {
    for (const { dayNumber, rejected, marker } of markersRef.current) {
      const match = selectedDay === null || dayNumber === selectedDay;
      const el = marker.getElement();
      el.style.opacity = !match ? '0.2' : rejected ? '0.55' : '1';
      el.style.zIndex = match ? '10' : '0';
      el.style.transform = match && selectedDay !== null ? 'scale(1.3)' : 'scale(1)';
    }
  }, [selectedDay]);

  if (activities.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-500 dark:border-neutral-700">
        Ninguna actividad tiene una ubicación válida para mostrar en el mapa.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-72 w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 sm:h-96"
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
