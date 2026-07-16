import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Pactify</h1>
      <p className="max-w-md text-neutral-500">
        Ponerse de acuerdo en un viaje en grupo es lo difícil. Cada uno mete sus
        preferencias, la IA propone un plan que contenta a todos y vosotros votáis.
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        Empezar
      </Link>
    </main>
  );
}
