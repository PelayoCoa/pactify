'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  leaveTrip,
  transferOrganizer,
  type TripFormState,
} from '@/app/trips/actions';

type Member = { user_id: string; name: string };

const initial: TripFormState = {};

function PendingButton({
  children,
  className,
  confirmMsg,
}: {
  children: React.ReactNode;
  className: string;
  confirmMsg?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (confirmMsg && !confirm(confirmMsg)) e.preventDefault();
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
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
            <PendingButton className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
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
          confirmMsg={
            isOrganizer && alone
              ? 'Eres el único. Si sales, el viaje se borra entero. ¿Seguro?'
              : '¿Salir de este viaje?'
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
