'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { createTrip, type TripFormState } from '@/app/trips/actions';
import type { BudgetMode } from '@/lib/types/database';

const initial: TripFormState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? 'Creando…' : 'Crear viaje'}
    </button>
  );
}

const inputCls =
  'rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900';

export function CreateTripForm() {
  const [state, formAction] = useActionState(createTrip, initial);
  const [mode, setMode] = useState<BudgetMode>('individual');

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Nombre del viaje
        </label>
        <input id="title" name="title" required placeholder="Escapada a Lisboa" className={inputCls} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="days" className="text-sm font-medium">
          Días
        </label>
        <input
          id="days"
          name="days"
          type="number"
          min={1}
          max={30}
          defaultValue={3}
          required
          className={inputCls}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Presupuesto</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="budget_mode"
            value="individual"
            checked={mode === 'individual'}
            onChange={() => setMode('individual')}
          />
          Individual — cada uno mete el suyo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="budget_mode"
            value="group"
            checked={mode === 'group'}
            onChange={() => setMode('group')}
          />
          De grupo — un bote común
        </label>
      </fieldset>

      {mode === 'group' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="group_budget" className="text-sm font-medium">
            Bote común (€)
          </label>
          <input
            id="group_budget"
            name="group_budget"
            type="number"
            min={0}
            step="0.01"
            required
            placeholder="1200"
            className={inputCls}
          />
        </div>
      )}

      <Submit />

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
