'use client';

import { useState } from 'react';

export function ShareItineraryLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard bloqueado: la URL sigue visible para copiarla a mano.
    }
  }

  return (
    <div className="card flex flex-col gap-2 p-4">
      <h2 className="text-sm font-medium">Compartir itinerario</h2>
      <p className="text-xs text-neutral-500">
        Cualquiera con este enlace puede ver el itinerario final, sin iniciar sesión.
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="field flex-1 text-xs"
        />
        <button type="button" onClick={copy} className="btn-secondary shrink-0">
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
