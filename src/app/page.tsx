import Link from 'next/link';

import { Logo } from '@/components/logo';

const STEPS = [
  { step: '1', title: 'Cada uno mete lo suyo', text: 'Presupuesto, qué le gusta y qué no, destinos que propone.' },
  { step: '2', title: 'La IA arma un plan', text: 'Genera un itinerario día a día que reparte el descontento de forma justa.' },
  { step: '3', title: 'Votáis cada actividad', text: 'A favor, en contra o abstención. Se puede regenerar hasta 2 veces.' },
  { step: '4', title: 'Veis el resultado en el mapa', text: 'Itinerario final con un pin por actividad, agrupado por día.' },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-12 p-6 py-16">
      <div className="flex flex-col items-center gap-5 text-center">
        <Logo size={100} />
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Pactify</h1>
          <p className="mx-auto max-w-md text-base leading-relaxed text-neutral-500 sm:text-lg">
            Organizar un viaje en grupo siempre acaba en discusión. Pactify recoge lo
            que quiere cada uno, arma un itinerario con IA y lo cierra por votación.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Link href="/login" className="btn-primary px-8 py-3 text-base">
            Empezar gratis
          </Link>
          <p className="text-xs text-neutral-400">Sin contraseñas. Solo tu email.</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-center text-xs font-semibold tracking-[0.2em] text-neutral-400 uppercase">
          Cómo funciona
        </h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STEPS.map((s) => (
            <li
              key={s.step}
              className="card flex gap-3 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
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
      </div>
    </main>
  );
}
