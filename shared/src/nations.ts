import type { AIDifficulty, PlayerSetup } from './types';
import { navigatorForNation } from './navigators';

export const NATIONS = [
  { name: 'Spain', color: 0xd64545 },
  { name: 'Netherlands', color: 0xf08a24 },
  { name: 'England', color: 0x3a6fd8 },
  { name: 'Portugal', color: 0x2e9e5b },
  { name: 'China', color: 0xe0b728 },
  { name: 'France', color: 0x36b7cf },
  { name: 'Japan', color: 0x9b59b6 },
  { name: 'Germany', color: 0x48434d },
  { name: 'Italy', color: 0x93bc3b },
  { name: 'Korea', color: 0xe477a5 },
] as const;

export type Nation = (typeof NATIONS)[number]['name'];
export type NationPick = { name: string; nation: Nation };

/** Keep human seats in pick order, then fill every other nation with an AI seat. */
export function createNationRoster(picks: readonly NationPick[], options?: AIDifficulty | { difficulty?: AIDifficulty; totalPlayers?: number }): PlayerSetup[] {
  if (!picks.length) throw new Error('At least one nation must be picked');
  const aiDifficulty = typeof options === 'string' ? options : options?.difficulty;
  const totalPlayers = (typeof options === 'object' ? options.totalPlayers : undefined) ?? NATIONS.length;
  if (!Number.isInteger(totalPlayers) || totalPlayers < 2 || totalPlayers > NATIONS.length) throw new Error('Total players must be an integer from 2 to 10');
  if (totalPlayers < picks.length) throw new Error('Total players cannot be fewer than human picks');
  const chosen = new Set<Nation>();
  const humans = picks.map(({ name, nation }) => {
    const entry = NATIONS.find((entry) => entry.name === nation);
    if (!entry) throw new Error(`Unknown nation: ${nation}`);
    if (chosen.has(nation)) throw new Error(`Nation already picked: ${nation}`);
    chosen.add(nation);
    return { name, nation, navigator: navigatorForNation(nation)?.id, color: entry.color, isAI: false };
  });
  return [
    ...humans,
    ...NATIONS.filter(({ name }) => !chosen.has(name)).slice(0, totalPlayers - humans.length).map(({ name, color }) => {
      const navigator = navigatorForNation(name);
      return { name: navigator?.name ?? name, nation: name, navigator: navigator?.id, color, isAI: true, ...(aiDifficulty && { aiDifficulty }) };
    }),
  ];
}
