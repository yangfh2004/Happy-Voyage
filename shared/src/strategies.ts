import type { Phase } from './types';

export type StrategyId = 'navigate' | 'inspire' | 'mislead' | 'locate' | 'betray';
export const STRATEGY_RULES = { handCap: 5, hoardGold: 300, inspireMultiplier: 1.5, bottleChance: 0.5 } as const;
export const STRATEGIES: Record<StrategyId, { id: StrategyId; name: string; chineseName: string; description: string; phases: Phase[] }> = {
  navigate: { id: 'navigate', name: 'Navigate', chineseName: '导航', description: 'Sail directly to any destination without a compass spin.', phases: ['awaitingSpin'] },
  inspire: { id: 'inspire', name: 'Inspire', chineseName: '激励', description: 'Boost firepower by 50% for your next battle this turn.', phases: ['awaitingToll'] },
  mislead: { id: 'mislead', name: 'Mislead', chineseName: '误导', description: 'Lure one defending ship ashore and wreck it.', phases: ['awaitingToll'] },
  locate: { id: 'locate', name: 'Locate', chineseName: '测位', description: 'Reveal the buried hoard until someone digs it up.', phases: ['awaitingSpin'] },
  betray: { id: 'betray', name: 'Betray', chineseName: '背叛', description: 'Convince one defending ship to join your fleet.', phases: ['awaitingToll'] },
};
