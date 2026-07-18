import Link from 'next/link';

/**
 * Cubre los notFound() de trips/[id] y de sus subrutas (destinations, vote,
 * itinerary, preferences): todas llaman a notFound() cuando el viaje no
 * existe o RLS oculta la fila -mismo 404 para ambos casos, para no filtrar
 * cuál es-, y ninguna define su propio not-found.tsx, así que Next usa este.
 */
export default function TripNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-semibold tracking-tight" style={{ color: 'var(--accent)' }}>
        404
      </p>
      <h1 className="text-xl font-semibold">Este viaje no existe</h1>
      <p className="text-sm text-neutral-500">
        O ya no tienes acceso a él -puede que hayas salido, o que el enlace esté mal escrito-.
      </p>
      <Link href="/dashboard" className="btn-primary mt-2">
        Volver a Mis viajes
      </Link>
    </main>
  );
}
