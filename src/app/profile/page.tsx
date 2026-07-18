import Link from 'next/link';
import { redirect } from 'next/navigation';

import { signOut } from '@/app/auth/actions';
import { DeleteAccount } from '@/components/profile/delete-account';
import { ProfileEditor } from '@/components/profile/profile-editor';
import { createClient } from '@/lib/supabase/server';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, avatar_url')
    .eq('id', user.id)
    .single();

  const email = profile?.email ?? user.email ?? '';
  const name = profile?.display_name ?? email.split('@')[0] ?? 'Tú';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="link-back">
          ← Mis viajes
        </Link>
        <form action={signOut}>
          <button type="submit" className="btn-ghost">
            Salir
          </button>
        </form>
      </header>

      <ProfileEditor initialName={name} initialAvatarUrl={profile?.avatar_url ?? null} email={email} />

      <DeleteAccount />
    </main>
  );
}
