import type { GameState, MapNode } from './types';

export function colonyValue(node: MapNode): number {
  return Math.floor((node.price ?? 0) * 0.75);
}

export function seatAtTurnOrderPosition(state: GameState, position: number): number {
  return (state.round - 1 + position) % state.players.length;
}

export function turnOrderPosition(state: GameState, playerId: number): number {
  return (playerId + state.players.length - seatAtTurnOrderPosition(state, 0)) % state.players.length;
}
