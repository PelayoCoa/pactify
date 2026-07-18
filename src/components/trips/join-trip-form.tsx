'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { joinTrip, type TripFormState } from '@/app/trips/actions';

const initial: TripFormState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-secondary"
    >
      {pending ? 'Uniéndote…' : 'Unirme'}
    </button>
  );
}

export function JoinTripForm() {
  const [state, formAction] = useActionState(joinTrip, initial);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="code"
          required
          placeholder="Código de invitación"
          autoCapitalize="characters"
          className="field flex-1 uppercase tracking-widest"
        />
        <Submit />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
