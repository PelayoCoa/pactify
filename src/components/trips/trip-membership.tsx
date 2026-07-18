'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  leaveTrip,
  transferOrganizer,
  type TripFormState,
} from '@/app/trips/actions';
import { useConfirmDialog, type ConfirmOptions } from '@/components/ui/confirm-dialog-provider';

type Member = { user_id: string; name: string };

const initial: TripFormState = {};

function PendingButton({
  children,
  className,
  confirmOptions,
}: {
  children: React.ReactNode;
  className: string;
  /** Si se pasa, el submit espera a que el usuario confirme en el modal propio. */
  confirmOptions?: ConfirmOptions;
}) {
  const { pending } = useFormStatus();
  const { confirm } = useConfirmDialog();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={async (e) => {
        if (!confirmOptions) return; // sin confirmación pedida: deja que el form se envíe normal
        e.preventDefault();
        const form = e.currentTarget.form;
        const ok = await confirm(confirmOptions);
        if (ok) form?.requestSubmit();
      }}
      className={className}
    >
      {children}
    </button>
  );
}

export function TripMembership({
  tripId,
  isOrganizer,
  otherMembers,
}: {
  tripId: string;
  isOrganizer: boolean;
  otherMembers: Member[];
}) {
  const [leaveState, leaveAction] = useActionState(leaveTrip, initial);
  const [transferState, transferAction] = useActionState(transferOrganizer, initial);

  const alone = otherMembers.length === 0;

  return (
    <div className="flex flex-col gap-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
      {/* Transferir organizador: solo si eres organizador y hay más gente. */}
      {isOrganizer && !alone && (
        <form action={transferAction} className="flex flex-col gap-2">
          <label className="text-sm font-medium">Pasar el rol de organizador</label>
          <div className="flex gap-2">
            <select
              name="new_organizer"
              required
              defaultValue=""
              className="field flex-1"
            >
              <option value="" disabled>
                Elige participante…
              </option>
              {otherMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input type="hidden" name="trip_id" value={tripId} />
            <PendingButton
              className="btn-secondary"
              confirmOptions={{
                title: '¿Transferir el rol de organizador?',
                description:
                  'Perderás el control del viaje -presupuesto, configuración, cerrar la votación-. Tendría que devolvértelo la otra persona.',
                confirmLabel: 'Transferir',
                danger: true,
              }}
            >
              Transferir
            </PendingButton>
          </div>
          {transferState.error && (
            <p role="alert" className="text-sm text-red-600">
              {transferState.error}
            </p>
          )}
        </form>
      )}

      {/* Salir. */}
      <form action={leaveAction} className="flex flex-col gap-2">
        <input type="hidden" name="trip_id" value={tripId} />
        <PendingButton
          confirmOptions={
            isOrganizer && alone
              ? {
                  title: 'Eres el único participante',
                  description: 'Si sales, el viaje se borra entero -itinerario incluido-. No se puede deshacer.',
                  confirmLabel: 'Salir y borrar el viaje',
                  danger: true,
                }
              : {
                  title: '¿Salir de este viaje?',
                  description: 'Dejarás de ver este viaje y sus actividades.',
                  confirmLabel: 'Salir del viaje',
                  danger: true,
                }
          }
          className="self-start rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          {isOrganizer && alone ? 'Salir y borrar el viaje' : 'Salir del viaje'}
        </PendingButton>
        {isOrganizer && !alone && (
          <p className="text-xs text-neutral-500">
            Como organizador, pasa el rol a alguien antes de salir.
          </p>
        )}
        {leaveState.error && (
          <p role="alert" className="text-sm text-red-600">
            {leaveState.error}
          </p>
        )}
      </form>
    </div>
  );
}
