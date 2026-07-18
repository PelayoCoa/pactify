import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CreateTripForm } from '@/components/trips/create-trip-form';
import { createClient } from '@/lib/supabase/server';

export default async function NewTripPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-8 p-6">
      <Link href="/dashboard" className="link-back">
        ← Mis viajes
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo viaje</h1>
        <p className="text-sm text-neutral-500">
          Al crearlo tendrás un código para invitar al resto.
        </p>
      </div>
      <CreateTripForm />
    </main>
  );
}
