import type { TripStatus, BudgetMode } from '@/lib/types/database';

/** Etiqueta + color de cada estado del viaje, para los badges. */
export const TRIP_STATUS: Record<
  TripStatus,
  { label: string; className: string }
> = {
  draft: { label: 'Borrador', className: 'bg-neutral-200 text-neutral-700' },
  collecting: { label: 'Recogiendo preferencias', className: 'bg-blue-100 text-blue-700' },
  generating: { label: 'Generando', className: 'bg-amber-100 text-amber-700' },
  voting: { label: 'En votación', className: 'bg-violet-100 text-violet-700' },
  finalized: { label: 'Cerrado', className: 'bg-emerald-100 text-emerald-700' },
};

export const BUDGET_MODE: Record<BudgetMode, string> = {
  individual: 'Presupuesto individual',
  group: 'Bote común',
};
