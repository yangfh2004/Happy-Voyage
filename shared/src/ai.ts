import type { GameState, Player } from './types';

/** Gold an AI keeps in reserve so it can survive a few tolls. */
const AI_RESERVE = 150;

/** Simple AI policy: claim any island it can afford while keeping a reserve. */
export function aiShouldClaim(state: GameState, player: Player, nodeId: number): boolean {
  const price = state.map[nodeId].price ?? Infinity;
  return player.gold - price >= AI_RESERVE;
}
