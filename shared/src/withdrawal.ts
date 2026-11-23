import type { Ship } from './types';

export type WithdrawalReason = 'retreat' | 'losses' | 'flagship';
export interface BattleWithdrawal {
  side: 'attacker' | 'defender';
  reason: WithdrawalReason;
}

export const sinkingCap = (fleet: Ship[]) => fleet.length < 2 ? fleet.length : Math.ceil(fleet.length / 2);

export function withdrawalReason(fleet: Ship[]): Exclude<WithdrawalReason, 'retreat'> | null {
  if (fleet.length < 2) return null;
  if (fleet.filter((s) => s.durability <= 0).length >= sinkingCap(fleet)) return 'losses';
  const flagship = [...fleet].sort((a, b) => Number(!!b.signature) - Number(!!a.signature) || b.maxDurability - a.maxDurability || a.id - b.id)[0];
  return flagship.durability <= flagship.maxDurability * .25 ? 'flagship' : null;
}
