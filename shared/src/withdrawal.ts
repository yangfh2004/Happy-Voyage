import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { PlayerSetup, Ship } from './types';

export const RETREAT_THRESHOLDS = ['quarter', 'half', 'threeQuarters', 'last'] as const;
export type RetreatThreshold = (typeof RETREAT_THRESHOLDS)[number];
export const isRetreatThreshold = (value: unknown): value is RetreatThreshold => RETREAT_THRESHOLDS.some(t => t === value);
export const playerRetreatThreshold = (player: Pick<PlayerSetup, 'isAI' | 'retreatThreshold'>): RetreatThreshold =>
  !player.isAI && isRetreatThreshold(player.retreatThreshold) ? player.retreatThreshold : 'half';

export type WithdrawalReason = 'retreat' | 'losses' | 'flagship';
export interface BattleWithdrawal {
  side: 'attacker' | 'defender';
  reason: WithdrawalReason;
}

export const sinkingCap = (startingAfloat: Ship[], threshold: RetreatThreshold = 'half') => threshold === 'last'
  ? startingAfloat.length : Math.max(1, Math.ceil(startingAfloat.length * GAMEPLAY_TUNING.combat.lossFraction[threshold]));

/** References to ships afloat at battle start, including any sunk since then. */
export function withdrawalReason(startingAfloat: Ship[], threshold: RetreatThreshold = 'half'): Exclude<WithdrawalReason, 'retreat'> | null {
  if (startingAfloat.length < 2 || threshold === 'last') return null;
  if (startingAfloat.filter((s) => s.durability <= 0).length >= sinkingCap(startingAfloat, threshold)) return 'losses';
  const flagship = [...startingAfloat].sort((a, b) => Number(!!b.signature) - Number(!!a.signature) || b.maxDurability - a.maxDurability || a.id - b.id)[0];
  return flagship.durability <= flagship.maxDurability * GAMEPLAY_TUNING.combat.flagshipRetreat ? 'flagship' : null;
}
