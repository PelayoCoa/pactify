'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { signInWithMagicLink, type AuthState } from '@/app/auth/actions';

const initialState: AuthState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? 'Enviando…' : 'Enviar enlace'}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signInWithMagicLink, initialState);

  if (state.status === 'sent') {
    return (
      <div className="rounded-xl border border-neutral-200 p-5 text-sm dark:border-neutral-800">
        <p className="font-medium">Revisa tu correo 📬</p>
        <p className="mt-1 text-neutral-500">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />

      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="tu@email.com"
        className="rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-400"
      />

      <SubmitButton />

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
