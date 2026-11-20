import type { GameState, MapNode } from './types';

export const REPAIR_GOLD_PER_POINT = 2;
export const SEA_HAZARD_DAMAGE = 10;

export function colonyValue(node: MapNode): number {
  return Math.floor((node.price ?? 0) * 0.75);
}

export function seatAtTurnOrderPosition(state: GameState, position: number): number {
  return position % state.players.length;
}

export function turnOrderPosition(state: GameState, playerId: number): number {
  return playerId % state.players.length;
}
