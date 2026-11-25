import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { Player, ShipType } from './types';
import type { Rng } from './compass';

export interface Captain {
  id: string;
  name: string;
  chineseName: string;
  minRank: number;
  fee: number;
  ships: readonly ShipType[];
}

export const MAX_CAPTAINS = GAMEPLAY_TUNING.captains.max;
export const CAPTAINS: readonly Captain[] = [
  { id: 'ines', name: 'Ines Tidewalker', chineseName: '踏潮者伊内丝', get minRank() { return GAMEPLAY_TUNING.captains.ines.minRank; }, get fee() { return GAMEPLAY_TUNING.captains.ines.fee; }, ships: ['explorer'] },
  { id: 'rui', name: 'Rui of the Reefs', chineseName: '暗礁鲁伊', get minRank() { return GAMEPLAY_TUNING.captains.rui.minRank; }, get fee() { return GAMEPLAY_TUNING.captains.rui.fee; }, ships: ['cargo'] },
  { id: 'mei', name: 'Mei Starwatcher', chineseName: '观星者梅', get minRank() { return GAMEPLAY_TUNING.captains.mei.minRank; }, get fee() { return GAMEPLAY_TUNING.captains.mei.fee; }, ships: ['warship'] },
  { id: 'gaspar', name: 'Gaspar Silverquill', chineseName: '银羽加斯帕', get minRank() { return GAMEPLAY_TUNING.captains.gaspar.minRank; }, get fee() { return GAMEPLAY_TUNING.captains.gaspar.fee; }, ships: ['explorer', 'cargo'] },
  { id: 'amara', name: 'Amara Stormglass', chineseName: '风镜阿玛拉', get minRank() { return GAMEPLAY_TUNING.captains.amara.minRank; }, get fee() { return GAMEPLAY_TUNING.captains.amara.fee; }, ships: ['explorer', 'cargo'] },
  { id: 'lin', name: 'Lin of the Silk Sails', chineseName: '丝帆林', get minRank() { return GAMEPLAY_TUNING.captains.lin.minRank; }, get fee() { return GAMEPLAY_TUNING.captains.lin.fee; }, ships: ['cargo', 'warship'] },
  { id: 'duarte', name: 'Duarte Red Compass', chineseName: '赤罗盘杜阿尔特', get minRank() { return GAMEPLAY_TUNING.captains.duarte.minRank; }, get fee() { return GAMEPLAY_TUNING.captains.duarte.fee; }, ships: ['cargo', 'warship'] },
  { id: 'zahra', name: 'Zahra Dawnseeker', chineseName: '逐曙扎赫拉', get minRank() { return GAMEPLAY_TUNING.captains.zahra.minRank; }, get fee() { return GAMEPLAY_TUNING.captains.zahra.fee; }, ships: ['warship', 'warship'] },
  { id: 'leonor', name: 'Leonor Golden Horizon', chineseName: '金海平线莱奥诺尔', get minRank() { return GAMEPLAY_TUNING.captains.leonor.minRank; }, get fee() { return GAMEPLAY_TUNING.captains.leonor.fee; }, ships: ['warship', 'warship'] },
];

export function recruitOffers(player: Player, rng: Rng): string[] {
  const pool = CAPTAINS.filter((captain) => captain.minRank <= player.rank && !player.captains.includes(captain.id));
  const offers: string[] = [];
  while (pool.length && offers.length < GAMEPLAY_TUNING.captains.offers) offers.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  return offers;
}

export function aiRecruitChoice(player: Player, offers: string[]): number | null {
  if (player.captains.length >= GAMEPLAY_TUNING.captains.max) return null;
  let best: number | null = null;
  let score = 0;
  offers.forEach((id, index) => {
    const captain = CAPTAINS.find((candidate) => candidate.id === id);
    if (!captain || captain.minRank > player.rank || player.captains.includes(id) || player.gold - captain.fee < GAMEPLAY_TUNING.captains.aiReserve) return;
    const value = captain.ships.length / captain.fee;
    if (value > score) { best = index; score = value; }
  });
  return best;
}
