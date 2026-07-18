'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error boundary]', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-semibold tracking-tight text-red-600">Ups</p>
      <h1 className="text-xl font-semibold">Algo ha ido mal</h1>
      <p className="text-sm text-neutral-500">
        Ha fallado algo inesperado. Puedes intentarlo de nuevo o volver a Mis viajes.
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={reset} className="btn-secondary">
          Reintentar
        </button>
        <Link href="/dashboard" className="btn-primary">
          Volver a Mis viajes
        </Link>
      </div>
    </main>
  );
}
