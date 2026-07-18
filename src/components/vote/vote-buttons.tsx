'use client';

import { useRef, useState } from 'react';

import { castVote } from '@/app/trips/[id]/vote/actions';
import { useToast } from '@/components/ui/toast-provider';
import type { VoteValue } from '@/lib/types/database';

const OPTIONS: { value: VoteValue; label: string }[] = [
  { value: 'against', label: 'En contra' },
  { value: 'abstain', label: 'Abstención' },
  { value: 'for', label: 'A favor' },
];

const VALUE_CLASS: Record<VoteValue, string> = {
  against: 'bg-red-600 text-white border-red-600',
  abstain:
    'bg-neutral-200 text-neutral-700 border-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:border-neutral-700',
  for: 'bg-emerald-600 text-white border-emerald-600',
};

export function VoteButtons({
  tripId,
  activityId,
  initialValue,
}: {
  tripId: string;
  activityId: string;
  initialValue: VoteValue | null;
}) {
  const [value, setValue] = useState<VoteValue | null>(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const { showToast } = useToast();

  async function pick(v: VoteValue) {
    if (inFlight.current) return;
    inFlight.current = true;
    setValue(v);
    setSaving(true);
    setError(null);

    const result = await castVote({ tripId, activityId, value: v });

    setSaving(false);
    inFlight.current = false;
    if (!result.ok) {
      setError(result.error);
      showToast(result.error, 'error');
    } else {
      showToast('Voto registrado.', 'success');
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
        {OPTIONS.map((o, i) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => pick(o.value)}
            className={`px-2.5 py-1 text-xs font-medium transition ${
              i > 0 ? 'border-l border-neutral-300 dark:border-neutral-700' : ''
            } ${
              value === o.value
                ? VALUE_CLASS[o.value]
                : 'bg-white text-neutral-500 hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {saving && <span className="text-[11px] text-neutral-400">Guardando…</span>}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
