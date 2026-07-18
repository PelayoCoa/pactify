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
      className="btn-primary"
    >
      {pending ? 'Enviando…' : 'Enviar enlace'}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signInWithMagicLink, initialState);

  if (state.status === 'sent') {
    return (
      <div className="card p-5 text-sm">
        <p className="font-medium">Revisa tu correo</p>
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
        className="field"
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
