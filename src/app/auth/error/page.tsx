import Link from 'next/link';

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">No hemos podido validar el enlace</h1>
      <p className="text-sm text-neutral-500">
        {reason === 'missing_code'
          ? 'El enlace venía incompleto.'
          : (reason ?? 'Puede que haya caducado o que ya se hubiera usado.')}
      </p>
      <Link
        href="/login"
        className="btn-primary"
      >
        Pedir otro enlace
      </Link>
    </main>
  );
}
