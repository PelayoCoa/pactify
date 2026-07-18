'use client';

import { useState, useTransition } from 'react';

import { deleteMyAccount } from '@/app/profile/actions';

const PHRASE = 'ELIMINAR';

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = text.trim().toUpperCase() === PHRASE;

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteMyAccount(text);
      if (!result.ok) setError(result.error);
    });
  }

  if (!open) {
    return (
      <div className="rounded-xl border border-red-200 p-4 dark:border-red-900">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">Eliminar cuenta</p>
        <p className="mt-1 text-xs text-neutral-500">
          Borra tu perfil, tu email y tus preferencias de todos los viajes. No se puede deshacer.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-secondary mt-3 border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          Quiero eliminar mi cuenta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
      <div>
        <p className="text-sm font-semibold text-red-800 dark:text-red-300">
          Esto es irreversible.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-red-800/90 dark:text-red-300/90">
          <li>Se borran tu nombre, tu email, tu foto y tus preferencias de todos los viajes.</li>
          <li>
            Si organizas algún viaje con más gente, el rol pasa automáticamente a quien lleve más
            tiempo en el grupo. Si estás solo en un viaje, ese viaje se borra entero.
          </li>
          <li>Tus votos ya emitidos se quedan, pero como &quot;Usuario eliminado&quot;, sin tu nombre.</li>
          <li>No podrás recuperar el acceso con este email después.</li>
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm-delete" className="text-xs font-medium text-red-800 dark:text-red-300">
          Escribe {PHRASE} para confirmar
        </label>
        <input
          id="confirm-delete"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PHRASE}
          autoComplete="off"
          className="field border-red-300 focus:border-red-600 dark:border-red-800"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSubmit || pending}
          onClick={onConfirm}
          className="btn-danger"
        >
          {pending ? 'Eliminando…' : 'Eliminar mi cuenta para siempre'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setText('');
            setError(null);
          }}
          className="btn-ghost"
        >
          Cancelar
        </button>
      </div>

      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
