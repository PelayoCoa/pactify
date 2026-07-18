'use client';

import { useState, useTransition } from 'react';

import { finalizeVoting } from '@/app/trips/[id]/vote/actions';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { useToast } from '@/components/ui/toast-provider';

export function FinalizeButton({ tripId }: { tripId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();

  async function onClick() {
    const ok = await confirm({
      title: 'Cerrar la votación',
      description:
        'Se queda con el itinerario tal como está ahora mismo, sin esperar más votos ni regeneraciones. No se puede deshacer.',
      confirmLabel: 'Cerrar votación',
      danger: true,
    });
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await finalizeVoting(tripId);
      if (!result.ok) {
        setError(result.error);
        showToast(result.error, 'error');
      } else {
        showToast('Votación cerrada. Itinerario finalizado.', 'success');
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className="btn-secondary"
      >
        {pending ? 'Cerrando…' : 'Decisión final: cerrar votación'}
      </button>
      <p className="text-xs text-neutral-400">
        Salida de emergencia del organizador. No hace falta esperar a que todos voten.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
