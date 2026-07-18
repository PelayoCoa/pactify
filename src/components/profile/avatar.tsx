const SIZE_CLASS = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-20 w-20 text-2xl',
} as const;

/**
 * Avatar de usuario, reutilizado en todos los sitios donde se muestra a
 * alguien: perfil propio, lista de participantes, propuestas de destino. Si
 * no hay foto, cae al mismo círculo con inicial que ya se usaba antes.
 */
export function Avatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASS;
}) {
  const dims = SIZE_CLASS[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${dims} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full font-semibold`}
      style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
