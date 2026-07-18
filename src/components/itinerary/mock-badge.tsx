/**
 * Se guarda `model: 'mock'` en itinerary_versions cuando USE_MOCK_AI generó
 * la respuesta (ver lib/ai/generate-itinerary.ts). Antes ese dato no se veía
 * en ninguna pantalla -riesgo real en una demo en vivo si la env var no está
 * puesta a "false" donde se despliegue-. Reutiliza .badge + el mismo tono
 * ámbar que .alert-warning, no una paleta nueva.
 */
export function MockBadge() {
  return (
    <span className="badge shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
      Datos de ejemplo (modo mock)
    </span>
  );
}
