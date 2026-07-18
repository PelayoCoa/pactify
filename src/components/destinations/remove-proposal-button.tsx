'use client';

import { useTransition } from 'react';

import { removeDestinationProposal } from '@/app/trips/[id]/destinations/actions';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { useToast } from '@/components/ui/toast-provider';

export function RemoveProposalButton({
  tripId,
  proposalId,
}: {
  tripId: string;
  proposalId: string;
}) {
  const [pending, startTransition] = useTransition();
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();

  async function onClick() {
    const ok = await confirm({
      title: '¿Retirar esta propuesta?',
      description: 'Dejará de verse en la lista de propuestas del grupo.',
      confirmLabel: 'Retirar',
      danger: true,
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await removeDestinationProposal(tripId, proposalId);
      if (result.ok) {
        showToast('Propuesta retirada.', 'success');
      } else {
        showToast(result.error, 'error');
      }
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? 'Quitando…' : 'Retirar'}
    </button>
  );
}
