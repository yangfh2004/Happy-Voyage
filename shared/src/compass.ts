import { GAMEPLAY_TUNING } from './gameplayTuning';

/** A random source returning [0, 1). Injected so tests and servers can seed it. */
export type Rng = () => number;

export const COMPASS_SECTORS = Object.keys(GAMEPLAY_TUNING.compass).map((key, index) => {
  const step = key as keyof typeof GAMEPLAY_TUNING.compass;
  return {
    steps: index + 2,
    get slots() { return GAMEPLAY_TUNING.compass[step]; },
    get odds() { return this.slots / slotCount(); },
  };
});

const slotCount = () => Object.values(GAMEPLAY_TUNING.compass).reduce((sum, weight) => sum + weight, 0);

export function spinCompass(rng: Rng): number {
  const target = Math.floor(rng() * slotCount());
  let edge = 0;
  for (const sector of COMPASS_SECTORS) {
    edge += sector.slots;
    if (target < edge) return sector.steps;
  }
  return COMPASS_SECTORS[COMPASS_SECTORS.length - 1].steps;
}
