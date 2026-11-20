import type { PlayerSetup } from './types';

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
type NationPick = { name: string; nation: Nation };

/** Keep human seats in pick order, then fill every other nation with an AI seat. */
export function createNationRoster(picks: readonly NationPick[]): PlayerSetup[] {
  if (!picks.length) throw new Error('At least one nation must be picked');
  const chosen = new Set<Nation>();
  const humans = picks.map(({ name, nation }) => {
    const entry = NATIONS.find((entry) => entry.name === nation);
    if (!entry) throw new Error(`Unknown nation: ${nation}`);
    if (chosen.has(nation)) throw new Error(`Nation already picked: ${nation}`);
    chosen.add(nation);
    return { name, nation, color: entry.color, isAI: false };
  });
  return [
    ...humans,
    ...NATIONS.filter(({ name }) => !chosen.has(name)).map(({ name, color }) => (
      { name, nation: name, color, isAI: true }
    )),
  ];
}
