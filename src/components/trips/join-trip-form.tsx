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
      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
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
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
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
