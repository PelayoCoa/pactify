import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog-provider";
import { ToastProvider } from "@/components/ui/toast-provider";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pactify",
  description: "Planificador de viajes en grupo con IA",
};

/**
 * Decide la clase .dark ANTES del primer pintado -por eso va inline y no en
 * un componente React, que llegaría después del HTML ya pintado y se vería
 * un parpadeo del tema equivocado-. Si el usuario ya eligió a mano, gana
 * localStorage; si no, cae a prefers-color-scheme del sistema, que sigue
 * siendo el default.
 */
const THEME_INIT_SCRIPT = `
  (function () {
    try {
      var stored = localStorage.getItem('theme');
      var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', dark);
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ToastProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
