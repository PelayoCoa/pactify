/**
 * Logo de Pactify: un pin de ubicación con un check -destino decidido-.
 * Reutiliza var(--accent)/var(--accent-soft), los mismos tokens que ya usa
 * el resto de la app -incluido el que invierte solo en modo oscuro-, así que
 * no hace falta ninguna paleta nueva ni un SVG "modo oscuro" aparte.
 */
export function Logo({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Pactify"
    >
      <circle cx="50" cy="50" r="50" fill="var(--accent-soft)" />
      <path
        d="M50 16a26 26 0 0 0-26 26c0 20 26 46 26 46s26-26 26-46a26 26 0 0 0-26-26Z"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="42" r="11" stroke="var(--accent)" strokeWidth="5" />
      <path
        d="M41 58 L52 70 L80 38"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
