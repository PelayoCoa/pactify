'use client';

import { useState } from 'react';

export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard bloqueado: el código sigue visible para copiar a mano.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-neutral-900 p-4 text-white dark:bg-neutral-800">
      <div>
        <p className="text-xs text-neutral-400">Código de invitación</p>
        <p className="font-mono text-2xl tracking-[0.3em]">{code}</p>
      </div>
      <button
        onClick={copy}
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
      >
        {copied ? '¡Copiado!' : 'Copiar'}
      </button>
    </div>
  );
}
