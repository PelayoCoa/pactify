import Link from 'next/link';

const STEPS = [
  { step: '1', title: 'Cada uno mete lo suyo', text: 'Presupuesto, qué le gusta y qué no, destinos que propone.' },
  { step: '2', title: 'La IA arma un plan', text: 'Genera un itinerario día a día que reparte el descontento de forma justa.' },
  { step: '3', title: 'Votáis cada actividad', text: 'A favor, en contra o abstención. Se puede regenerar hasta 2 veces.' },
  { step: '4', title: 'Veis el resultado en el mapa', text: 'Itinerario final con un pin por actividad, agrupado por día.' },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 p-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Pactify</h1>
        <p className="max-w-md text-neutral-500">
          Ponerse de acuerdo en un viaje en grupo es lo difícil. Pactify reparte
          preferencias, genera un itinerario con IA y decide con los votos de todos.
        </p>
        <Link href="/login" className="btn-primary px-6 py-3 text-base">
          Empezar
        </Link>
      </div>

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.step} className="card flex gap-3 p-4">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {s.step}
            </span>
            <div>
              <p className="text-sm font-medium">{s.title}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
