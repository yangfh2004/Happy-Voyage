/** Playable nations. Later versions add unique ships, traits and quest lines. */
export const NATIONS = [
  { name: 'Spain', color: 0xd64545 },
  { name: 'England', color: 0x3a6fd8 },
  { name: 'Netherlands', color: 0xf08a24 },
  { name: 'Portugal', color: 0x2e9e5b },
  { name: 'China', color: 0xe0b728 },
  { name: 'Japan', color: 0x9b59b6 },
] as const;

export const cssColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
