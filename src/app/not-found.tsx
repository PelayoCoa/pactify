import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-semibold tracking-tight" style={{ color: 'var(--accent)' }}>
        404
      </p>
      <h1 className="text-xl font-semibold">Esta página no existe</h1>
      <p className="text-sm text-neutral-500">
        Puede que el enlace esté mal escrito o que la página se haya movido.
      </p>
      <Link href="/dashboard" className="btn-primary mt-2">
        Volver a Mis viajes
      </Link>
    </main>
  );
}
