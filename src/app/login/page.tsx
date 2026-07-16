import { LoginForm } from '@/components/auth/login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Pactify</h1>
        <p className="text-sm text-neutral-500">
          Entra con tu email. Te mandamos un enlace y listo, sin contraseñas.
        </p>
      </div>

      <LoginForm next={next ?? '/dashboard'} />
    </main>
  );
}
