import type { Player } from '@happy-voyage/shared';

/** Seat badge: AI rivals, "You" in a solo game, or P1, P2… when several people share the device. */
export function seatTag(players: readonly Player[], player: Player): string {
  if (player.isAI) return 'AI';
  const humans = players.filter((p) => !p.isAI);
  return humans.length > 1 ? `P${humans.findIndex((p) => p.id === player.id) + 1}` : 'You';
}
