/**
 * URL base de la app. Se usa para construir el enlace de retorno del magic link,
 * que Supabase incrusta en el email.
 *
 * Orden: variable explícita > URL que inyecta Vercel > localhost.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    'http://localhost:3000';

  return raw.replace(/\/$/, '');
}
