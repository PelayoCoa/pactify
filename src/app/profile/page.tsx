import Link from 'next/link';
import { redirect } from 'next/navigation';

import { signOut } from '@/app/auth/actions';
import { createClient } from '@/lib/supabase/server';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', user.id)
    .single();

  const name = profile?.display_name ?? profile?.email?.split('@')[0] ?? 'Tú';
  const initial = name.charAt(0).toUpperCase();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Mis viajes
        </Link>
        <form action={signOut}>
          <button type="submit" className="text-sm text-neutral-500 hover:underline">
            Salir
          </button>
        </form>
      </header>

      <section className="flex flex-col items-center gap-4 text-center">
        {/* Foto de perfil: pendiente. De momento, inicial sobre círculo. */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-900 text-2xl font-semibold text-white">
          {initial}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{name}</h1>
          <p className="text-sm text-neutral-500">{profile?.email ?? user.email}</p>
        </div>
      </section>

      <p className="rounded-lg bg-neutral-100 p-3 text-center text-xs text-neutral-500 dark:bg-neutral-900">
        El nombre sale de tu email. Poder editarlo y subir foto llegará más adelante.
      </p>
    </main>
  );
}
