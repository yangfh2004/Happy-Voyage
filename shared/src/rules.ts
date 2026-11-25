import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { GameState, MapNode, Player } from './types';

export const REPAIR_GOLD_PER_POINT = GAMEPLAY_TUNING.economy.repairGoldPerPoint;
export const SEA_HAZARD_DAMAGE = GAMEPLAY_TUNING.economy.seaHazardDamage;
export const COLONY_RETURN_COOLDOWN = GAMEPLAY_TUNING.economy.colonyReturnCooldown;

export function isEliminated(player: Player): boolean {
  return player.bankrupt || player.fleetLost === true;
}

export function colonyValue(node: MapNode): number {
  return Math.floor((node.price ?? 0) * GAMEPLAY_TUNING.economy.colonyResaleRate);
}

export function seatAtTurnOrderPosition(state: GameState, position: number): number {
  return position % state.players.length;
}

export function turnOrderPosition(state: GameState, playerId: number): number {
  return playerId % state.players.length;
}
