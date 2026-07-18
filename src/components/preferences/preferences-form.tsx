'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { saveDraft, submitPreferences } from '@/app/trips/[id]/preferences/actions';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { useToast } from '@/components/ui/toast-provider';
import type { BudgetMode, CategoryStance } from '@/lib/types/database';

type CategoryRow = { id: string; slug: string; label: string; emoji: string | null };

type Props = {
  tripId: string;
  budgetMode: BudgetMode;
  categories: CategoryRow[];
  initialBudget: number | null;
  initialVetoes: string;
  initialStances: Record<string, CategoryStance>;
  initialSubmittedAt: string | null;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const STANCES: { value: CategoryStance; label: string }[] = [
  { value: 'hated', label: 'No' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'favorite', label: 'Sí' },
];

const STANCE_CLASS: Record<CategoryStance, string> = {
  hated: 'bg-red-600 text-white border-red-600',
  neutral: 'bg-neutral-200 text-neutral-700 border-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:border-neutral-700',
  favorite: 'bg-emerald-600 text-white border-emerald-600',
};

const DEBOUNCE_MS = 700;

export function PreferencesForm({
  tripId,
  budgetMode,
  categories,
  initialBudget,
  initialVetoes,
  initialStances,
  initialSubmittedAt,
}: Props) {
  const [budget, setBudget] = useState(initialBudget?.toString() ?? '');
  const [vetoes, setVetoes] = useState(initialVetoes);
  const [stances, setStances] = useState<Record<string, CategoryStance>>(initialStances);
  const [submittedAt, setSubmittedAt] = useState(initialSubmittedAt);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmPending, startConfirm] = useTransition();
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();

  const locked = submittedAt !== null;

  // Fuente de verdad para el flush: los refs no sufren closures viejas del
  // setTimeout, a diferencia de leer los useState directamente.
  const latest = useRef({ budget, vetoes, stances });
  latest.current = { budget, vetoes, stances };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (locked) return;
    setSaveState('saving');
    const { budget: b, vetoes: v, stances: s } = latest.current;
    const parsed = b.trim() === '' ? null : Number(b);
    const budgetAmount = parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;

    const result = await saveDraft({
      tripId,
      budgetAmount,
      vetoes: v.trim() === '' ? null : v,
      stances: s,
    });

    if (result.ok) {
      setSaveState('saved');
      setError(null);
    } else {
      setSaveState('error');
      setError(result.error);
    }
  }, [locked, tripId]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onStanceClick(categoryId: string, value: CategoryStance) {
    if (locked) return;
    setStances((prev) => ({ ...prev, [categoryId]: value }));
    // Clic = intención clara, sin esperar el debounce completo.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 150);
  }

  async function onConfirm() {
    if (locked) return;
    const ok = await confirm({
      title: '¿Confirmar tus preferencias?',
      description: 'No podrás editarlas después de confirmarlas.',
      confirmLabel: 'Confirmar',
    });
    if (!ok) return;

    startConfirm(async () => {
      // Asegura que el último cambio quede guardado antes de bloquear.
      if (timer.current) clearTimeout(timer.current);
      await flush();

      const result = await submitPreferences(tripId);
      if (result.ok) {
        setSubmittedAt(new Date().toISOString());
        showToast('Preferencias confirmadas.', 'success');
      } else {
        setError(result.error);
        showToast(result.error, 'error');
      }
    });
  }

  if (locked) {
    return (
      <div className="space-y-4">
        <div className="alert-success rounded-xl p-4">
          Ya confirmaste tus preferencias el{' '}
          {new Date(submittedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}.
          Están bloqueadas y no se pueden editar.
        </div>

        <dl className="card space-y-3 p-4 text-sm">
          <div>
            <dt className="text-neutral-500">Presupuesto</dt>
            <dd>{budget ? `${budget} €` : 'Sin especificar'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Vetos</dt>
            <dd>{vetoes || 'Ninguno'}</dd>
          </div>
          <div>
            <dt className="mb-1 text-neutral-500">Categorías</dt>
            <dd className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <span
                  key={c.id}
                  className={`rounded-full border px-2 py-0.5 text-xs ${STANCE_CLASS[stances[c.id] ?? 'neutral']}`}
                >
                  {c.emoji} {c.label}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="budget" className="text-sm font-medium">
          Tu presupuesto (€)
        </label>
        {budgetMode === 'group' && (
          <p className="alert-warning text-xs">
            Este viaje usa un bote común. Este número es solo orientativo, no se usa para repartir gastos.
          </p>
        )}
        <input
          id="budget"
          type="number"
          min={0}
          step="0.01"
          value={budget}
          onChange={(e) => {
            setBudget(e.target.value);
            schedule();
          }}
          onBlur={flush}
          placeholder="500"
          className="field"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">¿Qué te apetece?</span>
        <ul className="card divide-y divide-neutral-200 dark:divide-neutral-800">
          {categories.map((c) => {
            const stance = stances[c.id] ?? 'neutral';
            return (
              <li
                key={c.id}
                className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="text-sm">
                  {c.emoji} {c.label}
                </span>
                <div className="flex w-fit overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
                  {STANCES.map((s, i) => (
                    <button
                      key={s.value}
                      type="button"
                      aria-pressed={stance === s.value}
                      onClick={() => onStanceClick(c.id, s.value)}
                      className={`px-2.5 py-1 text-xs font-medium transition ${
                        i > 0 ? 'border-l border-neutral-300 dark:border-neutral-700' : ''
                      } ${
                        stance === s.value
                          ? STANCE_CLASS[s.value]
                          : 'bg-white text-neutral-500 hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="vetoes" className="text-sm font-medium">
          Vetos (opcional)
        </label>
        <textarea
          id="vetoes"
          rows={3}
          value={vetoes}
          onChange={(e) => {
            setVetoes(e.target.value);
            schedule();
          }}
          onBlur={flush}
          placeholder="Nada de madrugar, soy alérgico al marisco…"
          className="field resize-none"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-neutral-400">
          {saveState === 'saving' && 'Guardando…'}
          {saveState === 'saved' && 'Guardado'}
          {saveState === 'error' && <span className="text-red-600">{error}</span>}
          {saveState === 'idle' && ' '}
        </span>
        <button
          type="button"
          disabled={confirmPending}
          onClick={onConfirm}
          className="btn-primary"
        >
          {confirmPending ? 'Confirmando…' : 'Confirmar mis preferencias'}
        </button>
      </div>
    </div>
  );
}
