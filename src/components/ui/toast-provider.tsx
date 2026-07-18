'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

type ToastItem = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Reutiliza las clases .alert-* que ya existen -no se define paleta nueva. */
const VARIANT_CLASS: Record<ToastVariant, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
};

const DISMISS_MS = 4000;

/**
 * Reemplaza alert()/mensajes sueltos por avisos que no bloquean nada y
 * desaparecen solos. Apilados en la esquina superior derecha, más nuevo
 * arriba. Vive en el layout raíz: sobrevive a cualquier cambio de pantalla,
 * así que navegar mientras un toast está visible no lo rompe ni lo deja
 * "pegado" -son sus propios timers, independientes de la página que los pidió.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = nextId.current++;
      // Se añade al principio: el más reciente queda arriba del todo.
      setToasts((prev) => [{ id, message, variant }, ...prev]);
      const timeout = setTimeout(() => dismiss(id), DISMISS_MS);
      timers.current.set(id, timeout);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed top-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`${VARIANT_CLASS[t.variant]} pointer-events-auto flex items-start gap-3 rounded-xl border border-black/5 shadow-lg dark:border-white/10`}
          >
            <p className="flex-1 text-sm">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar aviso"
              className="shrink-0 text-base leading-none opacity-60 transition hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  return ctx;
}
