import type { NextConfig } from "next";

/*
 * CSP básica de hackathon, no una hardened para producción a largo plazo.
 * Dos concesiones concretas que valen la pena dejar por escrito:
 *
 *   - script-src incluye 'unsafe-inline': el script de layout.tsx que decide
 *     el tema oscuro/claro antes del primer pintado es un <script> inline a
 *     propósito (tiene que correr antes de que React hidrate nada). Sin
 *     'unsafe-inline' ese script -y con él, el modo oscuro por defecto- se
 *     bloquearía. La alternativa correcta es un nonce por request generado
 *     en middleware, pero eso es más máquina de la que hace falta aquí.
 *   - style-src incluye 'unsafe-inline': los popups de MapLibre
 *     (itinerary-map.tsx) se construyen con .setHTML() e incluyen atributos
 *     style="..." inline -sin esto, los popups del mapa perderían sus colores-.
 *
 * Orígenes externos reales del proyecto: Supabase (auth/REST/Storage,
 * dominio *.supabase.co porque cambia según el proyecto) y MapTiler (mapa y
 * geocoding, api.maptiler.com). Anthropic solo se llama desde el servidor
 * (generate-itinerary.ts), nunca desde el navegador, así que no necesita
 * hueco en esta CSP.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://api.maptiler.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://api.maptiler.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Por defecto Next limita el body de una Server Action a 1MB, antes de
      // que updateAvatar llegue a ejecutarse -de ahí que el límite real fuera
      // 1MB pese a validar 2MB en el código-. El multipart añade cabeceras y
      // boundaries de por medio, así que se deja margen sobre los 2MB reales.
      bodySizeLimit: '3mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Redundante con frame-ancestors de la CSP a propósito: cabecera
          // más antigua, la respetan navegadores/herramientas que todavía no
          // miran frame-ancestors.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
