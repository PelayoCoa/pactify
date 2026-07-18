/** Un color por día, cíclico. Se usa en los pines del mapa y en los chips del selector de día. */
const DAY_COLORS = [
  '#0F6E56', // teal
  '#B45309', // ámbar oscuro
  '#BE123C', // rosa/rojo
  '#1D4ED8', // azul
  '#6D28D9', // violeta
  '#15803D', // verde
];

export function dayColor(dayNumber: number): string {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
}
