import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { GameState } from './types';
import { SEA_RULES } from './seaRules';

export const RANKS = [
  { name: 'Ensign', chineseName: '少尉', get merit() { return GAMEPLAY_TUNING.ranks.ensign.merit; }, get salary() { return GAMEPLAY_TUNING.ranks.ensign.salary; }, get taxDiscount() { return GAMEPLAY_TUNING.ranks.ensign.taxDiscount; }, get purse() { return GAMEPLAY_TUNING.ranks.ensign.purse; } },
  { name: 'Lieutenant (Junior Grade)', chineseName: '中尉', get merit() { return GAMEPLAY_TUNING.ranks.junior.merit; }, get salary() { return GAMEPLAY_TUNING.ranks.junior.salary; }, get taxDiscount() { return GAMEPLAY_TUNING.ranks.junior.taxDiscount; }, get purse() { return GAMEPLAY_TUNING.ranks.junior.purse; } },
  { name: 'Lieutenant', chineseName: '上尉', get merit() { return GAMEPLAY_TUNING.ranks.lieutenant.merit; }, get salary() { return GAMEPLAY_TUNING.ranks.lieutenant.salary; }, get taxDiscount() { return GAMEPLAY_TUNING.ranks.lieutenant.taxDiscount; }, get purse() { return GAMEPLAY_TUNING.ranks.lieutenant.purse; } },
  { name: 'Lieutenant Commander', chineseName: '少校', get merit() { return GAMEPLAY_TUNING.ranks.lieutenantCommander.merit; }, get salary() { return GAMEPLAY_TUNING.ranks.lieutenantCommander.salary; }, get taxDiscount() { return GAMEPLAY_TUNING.ranks.lieutenantCommander.taxDiscount; }, get purse() { return GAMEPLAY_TUNING.ranks.lieutenantCommander.purse; } },
  { name: 'Commander', chineseName: '中校', get merit() { return GAMEPLAY_TUNING.ranks.commander.merit; }, get salary() { return GAMEPLAY_TUNING.ranks.commander.salary; }, get taxDiscount() { return GAMEPLAY_TUNING.ranks.commander.taxDiscount; }, get purse() { return GAMEPLAY_TUNING.ranks.commander.purse; } },
  { name: 'Captain', chineseName: '上校', get merit() { return GAMEPLAY_TUNING.ranks.captain.merit; }, get salary() { return GAMEPLAY_TUNING.ranks.captain.salary; }, get taxDiscount() { return GAMEPLAY_TUNING.ranks.captain.taxDiscount; }, get purse() { return GAMEPLAY_TUNING.ranks.captain.purse; } },
] as const;

export function foreignTaxDue(rank: number): number {
  return Math.ceil(SEA_RULES.foreignTax * (1 - RANKS[rank].taxDiscount));
}

/** Durable achievements only: cash gifts from the crown cannot generate more merit. */
export function playerMerit(state: GameState, playerId: number): number {
  return state.owners.reduce<number>((merit, owner, nodeId) => owner !== playerId ? merit :
    merit + GAMEPLAY_TUNING.ranks.meritPerColony + Object.values(state.buildings[nodeId]).reduce((sum, level) => sum + level * GAMEPLAY_TUNING.ranks.meritPerBuildingLevel, 0), 0);
}

export interface RoyalAudience {
  playerId: number;
  rank: number;
  promoted: boolean;
  reward: number;
  message: string;
  text?: import('./i18n').Text;
}
