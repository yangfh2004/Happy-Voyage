import type { Player } from './types';
import type { Rng } from './compass';

export type CaptainBonus = 'toll' | 'tax' | 'salary';
export interface Captain {
  id: string;
  name: string;
  chineseName: string;
  minRank: number;
  fee: number;
  bonus: CaptainBonus;
  amount: number;
}

export const MAX_CAPTAINS = 3;
export const CAPTAINS: readonly Captain[] = [
  { id: 'ines', name: 'Ines Tidewalker', chineseName: '踏潮者伊内丝', minRank: 0, fee: 90, bonus: 'toll', amount: 0.1 },
  { id: 'rui', name: 'Rui of the Reefs', chineseName: '暗礁鲁伊', minRank: 0, fee: 100, bonus: 'tax', amount: 0.15 },
  { id: 'mei', name: 'Mei Starwatcher', chineseName: '观星者梅', minRank: 0, fee: 120, bonus: 'salary', amount: 30 },
  { id: 'gaspar', name: 'Gaspar Silverquill', chineseName: '银羽加斯帕', minRank: 1, fee: 180, bonus: 'tax', amount: 0.25 },
  { id: 'amara', name: 'Amara Stormglass', chineseName: '风镜阿玛拉', minRank: 2, fee: 250, bonus: 'toll', amount: 0.2 },
  { id: 'lin', name: 'Lin of the Silk Sails', chineseName: '丝帆林', minRank: 2, fee: 280, bonus: 'salary', amount: 65 },
  { id: 'duarte', name: 'Duarte Red Compass', chineseName: '赤罗盘杜阿尔特', minRank: 3, fee: 360, bonus: 'tax', amount: 0.4 },
  { id: 'zahra', name: 'Zahra Dawnseeker', chineseName: '逐曙扎赫拉', minRank: 4, fee: 480, bonus: 'toll', amount: 0.35 },
  { id: 'leonor', name: 'Leonor Golden Horizon', chineseName: '金海平线莱奥诺尔', minRank: 5, fee: 600, bonus: 'salary', amount: 130 },
];

export function captainBonus(player: Player, kind: CaptainBonus): number {
  const total = CAPTAINS.filter((captain) => player.captains.includes(captain.id) && captain.bonus === kind)
    .reduce((sum, captain) => sum + captain.amount, 0);
  return kind === 'salary' ? total : Math.min(0.75, total);
}

export function captainDescription(captain: Captain): string {
  return captain.bonus === 'salary' ? `+${captain.amount}g per home salary` :
    `${Math.round(captain.amount * 100)}% less ${captain.bonus === 'toll' ? 'colony toll' : 'foreign tax'}`;
}

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
    const value = captain.bonus === 'salary' ? captain.amount / 200 : captain.amount;
    if (value > score) { best = index; score = value; }
  });
  return best;
}
