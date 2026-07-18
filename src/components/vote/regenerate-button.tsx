'use client';

import { useState, useTransition } from 'react';

import { regenerateAction } from '@/app/trips/[id]/vote/actions';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { useToast } from '@/components/ui/toast-provider';

export function RegenerateButton({
  tripId,
  quorumMet,
  regenerationsUsed,
  maxRegenerations,
  reasonWhenBlocked,
}: {
  tripId: string;
  quorumMet: boolean;
  regenerationsUsed: number;
  maxRegenerations: number;
  reasonWhenBlocked: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();

  const roundsLeft = maxRegenerations - regenerationsUsed;
  const noRoundsLeft = roundsLeft <= 0;
  const disabled = pending || noRoundsLeft || !quorumMet;

  async function onClick() {
    const ok = await confirm({
      title: '¿Regenerar el itinerario?',
      description: 'Se usarán los votos actuales para ajustarlo. Esto gasta una de las regeneraciones que quedan.',
      confirmLabel: 'Regenerar',
    });
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await regenerateAction(tripId);
      if (!result.ok) {
        setError(result.error);
        showToast(result.error, 'error');
      } else {
        showToast('Itinerario regenerado.', 'success');
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="btn-primary"
      >
        {pending && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {pending
          ? 'Regenerando…'
          : noRoundsLeft
            ? 'Sin regeneraciones disponibles'
            : `Regenerar itinerario (quedan ${roundsLeft})`}
      </button>
      {pending && (
        <p className="alert-info text-xs">
          Regenerando con IA a partir de los votos actuales. Esto puede tardar un momento.
        </p>
      )}
      {!pending && !noRoundsLeft && !quorumMet && (
        <p className="text-xs text-neutral-500">{reasonWhenBlocked}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
