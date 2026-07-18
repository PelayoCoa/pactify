'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useToast, type ToastVariant } from '@/components/ui/toast-provider';

type Matcher = { value: string; message: string; variant?: ToastVariant };

/**
 * Lee un parámetro de la URL (p. ej. ?left=1 tras salir de un viaje, que llega
 * vía redirect() desde una Server Action), lanza el toast correspondiente una
 * sola vez y limpia el parámetro de la URL para que un refresco no lo repita.
 */
export function SearchParamToast({
  param,
  matchers,
}: {
  param: string;
  matchers: Matcher[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const value = searchParams.get(param);
    if (!value) return;

    const match = matchers.find((m) => m.value === value);
    if (!match) return;

    fired.current = true;
    showToast(match.message, match.variant ?? 'info');

    const next = new URLSearchParams(searchParams);
    next.delete(param);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    // Solo se quiere disparar una vez al montar con los params iniciales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
