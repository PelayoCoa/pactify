import type { VoteValue } from '@/lib/types/database';

export type VoteTally = { for: number; abstain: number; against: number };

/**
 * Criterio de "ronda completada" para disparar la regeneración: NO exijo el
 * 100% de los participantes en cada actividad.
 *
 * Por qué: en un grupo real, alguien siempre se olvida de votar una
 * actividad. Exigir el 100% bloquearía la regeneración indefinidamente por
 * una sola persona distraída, y solo hay 2 regeneraciones — no tiene sentido
 * que se malgaste tiempo del viaje esperando a que todos abran la app.
 *
 * En su lugar: cada actividad necesita votos de al menos 2/3 de los
 * participantes (redondeando hacia arriba) para considerarse "evaluada". La
 * ronda está completa cuando TODAS las actividades llegan a ese umbral.
 * Es un quorum por actividad, no un contador global de "X de Y votos" —
 * una actividad con 1 solo voto de 5 personas no cuenta como revisada aunque
 * el total acumulado del viaje parezca alto.
 *
 * El botón de "decisión final" del organizador sigue ahí como salida de
 * emergencia si el quorum nunca se alcanza.
 */
export const REGEN_QUORUM_FRACTION = 2 / 3;

export function quorumThreshold(totalParticipants: number): number {
  return Math.ceil(totalParticipants * REGEN_QUORUM_FRACTION);
}

export function tallyVotes(
  votes: { activity_id: string; value: VoteValue }[],
): Map<string, VoteTally> {
  const map = new Map<string, VoteTally>();
  for (const v of votes) {
    const t = map.get(v.activity_id) ?? { for: 0, abstain: 0, against: 0 };
    if (v.value === 'for') t.for++;
    else if (v.value === 'abstain') t.abstain++;
    else t.against++;
    map.set(v.activity_id, t);
  }
  return map;
}

export function votesCast(tally: VoteTally | undefined): number {
  return (tally?.for ?? 0) + (tally?.abstain ?? 0) + (tally?.against ?? 0);
}

export function activityMeetsQuorum(
  tally: VoteTally | undefined,
  threshold: number,
): boolean {
  return votesCast(tally) >= threshold;
}

/** Empate real: mismo número de a favor y en contra, y al menos un voto de cada. */
export function isTie(tally: VoteTally | undefined): boolean {
  return !!tally && tally.for === tally.against && tally.for > 0;
}

/**
 * Más votos en contra que a favor. Un empate NO cuenta como rechazada -eso
 * lo decide la IA en la regeneración (ver isTie), no un umbral fijo aquí.
 */
export function isRejected(tally: VoteTally | undefined): boolean {
  return (tally?.against ?? 0) > (tally?.for ?? 0);
}
