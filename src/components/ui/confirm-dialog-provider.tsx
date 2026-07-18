'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = botón de confirmar en rojo (btn-danger). Por defecto btn-primary. */
  danger?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/**
 * Sustituye confirm() nativo por un modal propio, con el mismo cuidado que ya
 * tenía la pantalla de eliminar cuenta: texto claro de lo que va a pasar y
 * botones diferenciados. Un solo diálogo pendiente a la vez -si se pide otro
 * mientras uno está abierto, sustituye al anterior en vez de apilar modales.
 */
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  pendingRef.current = pending;

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      setPending({ ...options, resolve });
    });
  }

  function close(result: boolean) {
    pendingRef.current?.resolve(result);
    setPending(null);
  }

  // Escape cierra como "cancelar" -misma vía de escape que cualquier modal.
  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {pending && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={pending.description ? 'confirm-dialog-description' : undefined}
            className="card w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-dialog-title" className="text-base font-semibold">
              {pending.title}
            </h2>
            {pending.description && (
              <p
                id="confirm-dialog-description"
                className="mt-2 text-sm text-neutral-600 dark:text-neutral-400"
              >
                {pending.description}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                className="btn-secondary"
                onClick={() => close(false)}
              >
                {pending.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                className={pending.danger ? 'btn-danger' : 'btn-primary'}
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirmDialog(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirmDialog debe usarse dentro de <ConfirmDialogProvider>.');
  return ctx;
}
