'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { useToast } from '@/components/ui/toast-provider';

/**
 * Dispara /api/trips/[id]/generate -la v1 del itinerario-. No existía ningún
 * botón para esto en la UI: el endpoint solo se podía probar por curl. Es
 * quien organiza porque gasta presupuesto de IA y no hay vuelta atrás fácil.
 */
export function GenerateItineraryButton({ tripId }: { tripId: string }) {
  const { showToast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await fetch(`/api/trips/${tripId}/generate`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(body.error ?? 'No se pudo generar el itinerario. Inténtalo de nuevo.', 'error');
        return;
      }

      showToast('Itinerario generado.', 'success');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={pending} onClick={onClick} className="btn-primary">
        {pending && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {pending ? 'Generando…' : 'Generar itinerario'}
      </button>
      {pending && (
        <p className="alert-info text-xs">
          Generando tu itinerario con IA. Esto puede tardar un momento -no cierres esta pantalla.
        </p>
      )}
    </div>
  );
}
