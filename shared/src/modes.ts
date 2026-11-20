import { createDefaultMap } from './map';
import type { GameConfig } from './types';

/** New continents on the standard chart (the original's 40). */
export const DEFAULT_ISLAND_COUNT = createDefaultMap().filter((node) => node.kind === 'island').length;

/** Rounds stand in for "no limit" in modes that only end by conquest or bankruptcy (kept finite so state stays JSON-safe). */
export const NO_ROUND_LIMIT = 999;

export type GameModeId = 'conquest' | 'quick' | 'sprint';

export interface GameMode {
  id: GameModeId;
  name: string;
  description: string;
  /** islandsToWin above the map's island count means every new continent. */
  config: Pick<GameConfig, 'islandsToWin' | 'maxRounds'>;
}

export const GAME_MODES: readonly GameMode[] = [
  {
    id: 'conquest',
    name: 'Classic conquest',
    description: 'The original rule: hold every new continent at once. No round limit.',
    config: { islandsToWin: Number.MAX_SAFE_INTEGER, maxRounds: NO_ROUND_LIMIT },
  },
  {
    id: 'quick',
    name: 'Quick match',
    description: 'Claim 10 islands, or be richest after 50 rounds.',
    config: { islandsToWin: 10, maxRounds: 50 },
  },
  {
    id: 'sprint',
    name: 'Sprint',
    description: 'Claim 6 islands, or be richest after 20 rounds.',
    config: { islandsToWin: 6, maxRounds: 20 },
  },
];

export function gameMode(id: GameModeId): GameMode {
  return GAME_MODES.find((mode) => mode.id === id)!;
}

export function hasRoundLimit(config: Pick<GameConfig, 'maxRounds'>): boolean {
  return config.maxRounds < NO_ROUND_LIMIT;
}

/** Rounds still to play; an unlimited game always has NO_ROUND_LIMIT left. */
export function roundsLeft(config: Pick<GameConfig, 'maxRounds'>, round: number): number {
  return hasRoundLimit(config) ? Math.max(0, config.maxRounds - round) : NO_ROUND_LIMIT;
}

/** True when the island goal is every new continent on the map. */
export function requiresEveryIsland(config: Pick<GameConfig, 'islandsToWin'>, islandCount: number): boolean {
  return config.islandsToWin >= islandCount;
}

/** The ways to win under this config, as a sentence fragment ("hold all 40 new continents at once or ..."). */
export function winConditionText(config: Pick<GameConfig, 'islandsToWin' | 'maxRounds'>, islandCount: number): string {
  const goal = requiresEveryIsland(config, islandCount)
    ? `hold all ${islandCount} new continents at once`
    : `claim ${config.islandsToWin} islands`;
  return hasRoundLimit(config)
    ? `${goal}, be the last navigator afloat, or have the highest net worth after ${config.maxRounds} rounds`
    : `${goal} or be the last navigator afloat`;
}
