/** A random source returning [0, 1). Injected so tests and servers can seed it. */
export type Rng = () => number;

const SLOT_COUNT = 36;
export const COMPASS_SECTORS = Array.from({ length: 11 }, (_, index) => {
  const slots = 6 - Math.abs(index - 5);
  return { steps: index + 2, slots, odds: slots / SLOT_COUNT };
});

export function spinCompass(rng: Rng): number {
  const target = Math.floor(rng() * SLOT_COUNT);
  let edge = 0;
  for (const sector of COMPASS_SECTORS) {
    edge += sector.slots;
    if (target < edge) return sector.steps;
  }
  return COMPASS_SECTORS[COMPASS_SECTORS.length - 1].steps;
}
