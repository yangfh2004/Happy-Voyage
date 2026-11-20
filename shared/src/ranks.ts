import type { GameState } from './types';
import { SEA_RULES } from './seaRules';

export const RANKS = [
  { name: 'Commoner', chineseName: '平民', merit: 0, salary: 0, taxDiscount: 0, purse: 0 },
  { name: 'Knight', chineseName: '骑士', merit: 100, salary: 50, taxDiscount: 0.1, purse: 200 },
  { name: 'Baron', chineseName: '男爵', merit: 250, salary: 100, taxDiscount: 0.2, purse: 350 },
  { name: 'Viscount', chineseName: '子爵', merit: 450, salary: 175, taxDiscount: 0.3, purse: 500 },
  { name: 'Earl', chineseName: '伯爵', merit: 700, salary: 250, taxDiscount: 0.4, purse: 700 },
  { name: 'Duke', chineseName: '公爵', merit: 1000, salary: 350, taxDiscount: 0.5, purse: 1000 },
] as const;

export function foreignTaxDue(rank: number): number {
  return Math.ceil(SEA_RULES.foreignTax * (1 - RANKS[rank].taxDiscount));
}

/** Durable achievements only: cash gifts from the crown cannot generate more merit. */
export function playerMerit(state: GameState, playerId: number): number {
  return state.owners.reduce<number>((merit, owner, nodeId) => owner !== playerId ? merit :
    merit + 100 + Object.values(state.buildings[nodeId]).reduce((sum, level) => sum + level * 25, 0), 0);
}

export interface RoyalAudience {
  playerId: number;
  rank: number;
  promoted: boolean;
  reward: number;
  message: string;
}
