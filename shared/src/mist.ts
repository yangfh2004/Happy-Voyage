import type { StrategyId } from './strategies';

export const NIM_MAX_TAKE = 3;

export const HERMITS = [
  { id: 'brook', name: 'Brook Hermit', style: 'Gentle', reward: 'navigate' },
  { id: 'pine', name: 'Pine Hermit', style: 'Bold', reward: 'locate' },
  { id: 'summit', name: 'Summit Hermit', style: 'Expert', reward: 'inspire' },
] as const satisfies readonly { id: string; name: string; style: string; reward: StrategyId }[];

export type HermitId = typeof HERMITS[number]['id'];

export interface MistResult {
  round: number;
  playerId: number;
  nodeId: number;
  hermitId: HermitId;
  outcome: 'win' | 'loss';
  strategy: StrategyId | null;
}

export interface MistDuel {
  nodeId: number;
  hermitId: HermitId | null;
  stonesLeft: number;
  lastTurn: { playerTake: number; hermitTake: number | null } | null;
  result: MistResult | null;
}

export function hermitStoneTake(hermit: HermitId, stonesLeft: number): number {
  if (hermit === 'pine') return Math.min(NIM_MAX_TAKE, Math.max(1, stonesLeft - 1));
  // An expert leaves 1 mod 4 whenever possible, forcing the opponent to take the last stone.
  if (hermit === 'summit') return (stonesLeft - 1) % (NIM_MAX_TAKE + 1) || 1;
  return 1;
}
