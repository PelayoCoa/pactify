import type { TripStatus, BudgetMode } from '@/lib/types/database';

/** Etiqueta + color de cada estado del viaje, para los badges. */
export const TRIP_STATUS: Record<
  TripStatus,
  { label: string; className: string; accentClass: string }
> = {
  draft: {
    label: 'Borrador',
    className: 'bg-neutral-200 text-neutral-700',
    accentClass: 'border-l-neutral-300 dark:border-l-neutral-700',
  },
  collecting: {
    label: 'Recogiendo preferencias',
    className: 'bg-blue-100 text-blue-700',
    accentClass: 'border-l-blue-400 dark:border-l-blue-600',
  },
  generating: {
    label: 'Generando',
    className: 'bg-amber-100 text-amber-700',
    accentClass: 'border-l-amber-400 dark:border-l-amber-600',
  },
  voting: {
    label: 'En votación',
    className: 'bg-violet-100 text-violet-700',
    accentClass: 'border-l-violet-400 dark:border-l-violet-600',
  },
  finalized: {
    label: 'Cerrado',
    className: 'bg-emerald-100 text-emerald-700',
    accentClass: 'border-l-emerald-400 dark:border-l-emerald-600',
  },
};

export const BUDGET_MODE: Record<BudgetMode, string> = {
  individual: 'Presupuesto individual',
  group: 'Bote común',
};
