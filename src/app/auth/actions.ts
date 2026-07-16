'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';

export type AuthState = {
  status: 'idle' | 'sent' | 'error';
  message?: string;
};

/** Envía el magic link. Lo consume después /auth/callback. */
export async function signInWithMagicLink(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const next = String(formData.get('next') ?? '/dashboard');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { status: 'error', message: 'Ese email no tiene buena pinta.' };
  }

  const supabase = await createClient();

  const callback = new URL('/auth/callback', getSiteUrl());
  callback.searchParams.set('next', next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callback.toString(),
      // Si prefieres que nadie entre sin invitación previa, ponlo a false.
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return {
    status: 'sent',
    message: `Te hemos enviado un enlace a ${email}. Ábrelo en este mismo navegador.`,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
