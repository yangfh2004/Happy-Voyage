import type { GameState } from './types';
import { SEA_RULES } from './seaRules';

export const RANKS = [
  { name: 'Ensign', chineseName: '少尉', merit: 0, salary: 0, taxDiscount: 0, purse: 0 },
  { name: 'Lieutenant (Junior Grade)', chineseName: '中尉', merit: 100, salary: 50, taxDiscount: 0.1, purse: 200 },
  { name: 'Lieutenant', chineseName: '上尉', merit: 250, salary: 100, taxDiscount: 0.2, purse: 350 },
  { name: 'Lieutenant Commander', chineseName: '少校', merit: 450, salary: 175, taxDiscount: 0.3, purse: 500 },
  { name: 'Commander', chineseName: '中校', merit: 700, salary: 250, taxDiscount: 0.4, purse: 700 },
  { name: 'Captain', chineseName: '上校', merit: 1000, salary: 350, taxDiscount: 0.5, purse: 1000 },
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
  text?: import('./i18n').Text;
}
