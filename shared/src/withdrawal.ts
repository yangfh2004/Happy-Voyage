import type { Ship } from './types';

export type WithdrawalReason = 'retreat' | 'losses' | 'flagship';
export interface BattleWithdrawal {
  side: 'attacker' | 'defender';
  reason: WithdrawalReason;
}

export const sinkingCap = (startingAfloat: Ship[]) => Math.ceil(startingAfloat.length / 2);

/** References to ships afloat at battle start, including any sunk since then. */
export function withdrawalReason(startingAfloat: Ship[]): Exclude<WithdrawalReason, 'retreat'> | null {
  if (startingAfloat.length < 2) return null;
  if (startingAfloat.filter((s) => s.durability <= 0).length >= sinkingCap(startingAfloat)) return 'losses';
  const flagship = [...startingAfloat].sort((a, b) => Number(!!b.signature) - Number(!!a.signature) || b.maxDurability - a.maxDurability || a.id - b.id)[0];
  return flagship.durability <= flagship.maxDurability * .25 ? 'flagship' : null;
}
