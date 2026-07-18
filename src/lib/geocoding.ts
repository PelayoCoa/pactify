/** Cliente del geocoding de MapTiler. Se llama desde el navegador con la key pública. */

export type GeocodeResult = {
  name: string;
  country: string | null;
  lat: number;
  lon: number;
};

export class GeocodingError extends Error {}

export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) throw new GeocodingError('Falta configurar NEXT_PUBLIC_MAPTILER_KEY.');

  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${key}&limit=5`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new GeocodingError('No se pudo contactar con el buscador de lugares.');
  }

  if (!res.ok) throw new GeocodingError('El buscador de lugares no respondió correctamente.');

  const data = await res.json();
  const features: unknown[] = Array.isArray(data?.features) ? data.features : [];

  return features
    .map((f): GeocodeResult | null => {
      const feature = f as {
        place_name?: string;
        center?: [number, number];
        context?: { id?: string; text?: string }[];
      };
      if (!feature.place_name || !Array.isArray(feature.center)) return null;
      const [lon, lat] = feature.center;
      const country =
        feature.context?.find((c) => c.id?.startsWith('country'))?.text ?? null;
      return { name: feature.place_name, country, lat, lon };
    })
    .filter((r): r is GeocodeResult => r !== null);
}
