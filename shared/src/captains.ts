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

export const MAX_CAPTAINS = 3;
export const CAPTAINS: readonly Captain[] = [
  { id: 'ines', name: 'Ines Tidewalker', chineseName: '踏潮者伊内丝', minRank: 0, fee: 180, ships: ['explorer'] },
  { id: 'rui', name: 'Rui of the Reefs', chineseName: '暗礁鲁伊', minRank: 0, fee: 300, ships: ['cargo'] },
  { id: 'mei', name: 'Mei Starwatcher', chineseName: '观星者梅', minRank: 0, fee: 450, ships: ['warship'] },
  { id: 'gaspar', name: 'Gaspar Silverquill', chineseName: '银羽加斯帕', minRank: 1, fee: 480, ships: ['explorer', 'cargo'] },
  { id: 'amara', name: 'Amara Stormglass', chineseName: '风镜阿玛拉', minRank: 2, fee: 480, ships: ['explorer', 'cargo'] },
  { id: 'lin', name: 'Lin of the Silk Sails', chineseName: '丝帆林', minRank: 2, fee: 750, ships: ['cargo', 'warship'] },
  { id: 'duarte', name: 'Duarte Red Compass', chineseName: '赤罗盘杜阿尔特', minRank: 3, fee: 750, ships: ['cargo', 'warship'] },
  { id: 'zahra', name: 'Zahra Dawnseeker', chineseName: '逐曙扎赫拉', minRank: 4, fee: 900, ships: ['warship', 'warship'] },
  { id: 'leonor', name: 'Leonor Golden Horizon', chineseName: '金海平线莱奥诺尔', minRank: 5, fee: 900, ships: ['warship', 'warship'] },
];

export function recruitOffers(player: Player, rng: Rng): string[] {
  const pool = CAPTAINS.filter((captain) => captain.minRank <= player.rank && !player.captains.includes(captain.id));
  const offers: string[] = [];
  while (pool.length && offers.length < 3) offers.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  return offers;
}

export function aiRecruitChoice(player: Player, offers: string[]): number | null {
  if (player.captains.length >= MAX_CAPTAINS) return null;
  let best: number | null = null;
  let score = 0;
  offers.forEach((id, index) => {
    const captain = CAPTAINS.find((candidate) => candidate.id === id);
    if (!captain || captain.minRank > player.rank || player.captains.includes(id) || player.gold - captain.fee < 200) return;
    const value = captain.ships.length / captain.fee;
    if (value > score) { best = index; score = value; }
  });
  return best;
}
