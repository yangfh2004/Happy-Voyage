import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { Phase } from './types';

export type StrategyId = 'navigate' | 'inspire' | 'mislead' | 'locate' | 'betray' | 'tailwind' | 'reverse' | 'blockade' | 'plunder' | 'gale' | 'escort' | 'exemption' | 'ambush' | 'revolt' | 'harvest' | 'charter' | 'repair' | 'recall' | 'exchange' | 'scorch';
export type StrategyTarget = 'none' | 'node' | 'rival' | 'rivalColony';
export const STRATEGY_RULES = GAMEPLAY_TUNING.strategies;
export const STRATEGIES: Record<StrategyId, { id: StrategyId; name: string; chineseName: string; description: string; phases: Phase[]; target: StrategyTarget }> = {
  navigate: { id: 'navigate', name: 'Navigate', chineseName: '导航', description: 'Sail directly to any destination without a compass spin.', phases: ['awaitingSpin'], target: 'node' },
  inspire: { id: 'inspire', name: 'Inspire', chineseName: '激励', description: 'Boost firepower by 25% in every battle this turn, including pirates.', phases: ['awaitingSpin', 'awaitingToll'], target: 'none' },
  mislead: { id: 'mislead', name: 'Mislead', chineseName: '误导', description: 'Damage the lead defender in battle, or one random rival fleet ship at sea, by 40 durability (never below 1).', phases: ['awaitingSpin', 'awaitingToll'], target: 'rival' },
  locate: { id: 'locate', name: 'Locate', chineseName: '测位', description: 'Reveal the buried hoard until someone digs it up.', phases: ['awaitingSpin'], target: 'none' },
  betray: { id: 'betray', name: 'Betray', chineseName: '背叛', description: 'Recruit the weakest ship from the defenders or a rival fleet. A rival fleet keeps at least one ship.', phases: ['awaitingSpin', 'awaitingToll'], target: 'rival' },
  tailwind: { id: 'tailwind', name: 'Tailwind', chineseName: '顺风', description: 'Double this turn’s compass result.', phases: ['awaitingSpin'], target: 'none' },
  reverse: { id: 'reverse', name: 'Reverse Course', chineseName: '逆航', description: 'Sail backward on this turn’s compass spin.', phases: ['awaitingSpin'], target: 'none' },
  blockade: { id: 'blockade', name: 'Blockade', chineseName: '封港', description: 'A rival skips their next turn.', phases: ['awaitingSpin'], target: 'rival' },
  plunder: { id: 'plunder', name: 'Plunder', chineseName: '劫掠', description: 'Take 10% of a rival’s gold, up to 150g.', phases: ['awaitingSpin'], target: 'rival' },
  gale: { id: 'gale', name: 'Call the Gale', chineseName: '呼风', description: 'Damage every ship in a rival fleet by 15, never below 1 durability.', phases: ['awaitingSpin'], target: 'rival' },
  escort: { id: 'escort', name: 'Escort', chineseName: '护航', description: 'Block your next harmful sea event this game.', phases: ['awaitingSpin'], target: 'none' },
  exemption: { id: 'exemption', name: 'Toll Exemption', chineseName: '免税令', description: 'Pass a rival colony without paying its toll. Ends your turn; does not waive foreign tax.', phases: ['awaitingToll'], target: 'none' },
  ambush: { id: 'ambush', name: 'Surprise Attack', chineseName: '奇袭', description: 'Colony defenders deal half firepower in round 1 (auto) or cannot fire for 4s (real-time) this turn.', phases: ['awaitingToll'], target: 'none' },
  revolt: { id: 'revolt', name: 'Incite Revolt', chineseName: '煽动', description: 'Neutralize an undeveloped rival colony with no docked ships, clearing its goods.', phases: ['awaitingSpin'], target: 'rivalColony' },
  harvest: { id: 'harvest', name: 'Harvest', chineseName: '丰收', description: 'All your colonies immediately produce one extra round of goods.', phases: ['awaitingSpin'], target: 'none' },
  charter: { id: 'charter', name: 'Trade Charter', chineseName: '特许贸易', description: 'Gain 40g per colony you own, up to 300g.', phases: ['awaitingSpin'], target: 'none' },
  repair: { id: 'repair', name: 'Emergency Repairs', chineseName: '抢修', description: 'Restore up to 30 durability to every ship in your fleet.', phases: ['awaitingSpin'], target: 'none' },
  recall: { id: 'recall', name: 'Recall', chineseName: '召回', description: 'Return directly to your home port for a royal audience, without salary.', phases: ['awaitingSpin'], target: 'none' },
  exchange: { id: 'exchange', name: 'Exchange Positions', chineseName: '换位', description: 'Swap positions with a rival fleet, then spin normally.', phases: ['awaitingSpin'], target: 'rival' },
  scorch: { id: 'scorch', name: 'Burn Stores', chineseName: '焚仓', description: 'Destroy half of the lumber, iron and specialties (rounded up) stored at a rival colony.', phases: ['awaitingSpin'], target: 'rivalColony' },
};

export function strategyTarget(id: StrategyId, phase: Phase): StrategyTarget {
  return phase === 'awaitingToll' && (id === 'mislead' || id === 'betray') ? 'none' : STRATEGIES[id].target;
}

export function defectionCount(count: number, fromFleet: boolean): number {
  return Math.max(0, Math.min(STRATEGY_RULES.betrayMaxShips, count - (fromFleet ? 1 : 0)));
}
