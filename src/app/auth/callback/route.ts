import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * Aterrizaje del magic link.
 *
 * Supabase usa flujo PKCE, así que el enlace del email pasa por su endpoint de
 * verificación y acaba aquí con `?code=...`. Lo canjeamos por una sesión y las
 * cookies quedan escritas en la respuesta.
 *
 * El fallback con `token_hash` cubre el caso de que cambies la plantilla del
 * email para usar `{{ .TokenHash }}`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const next = searchParams.get('next') ?? '/dashboard';

  // Solo rutas internas: sin esto, `?next=https://malo.com` es un open redirect.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(error.message)}`,
    );
  }

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/auth/error?reason=missing_code`);
}
