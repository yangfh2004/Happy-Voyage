/** A random source returning [0, 1). Injected so tests and servers can seed it. */
export type Rng = () => number;

export function rollDie(rng: Rng): number {
  return 1 + Math.floor(rng() * 6);
}

/** Two six-sided dice, the classic Monopoly feel. */
export function rollDice(rng: Rng): [number, number] {
  return [rollDie(rng), rollDie(rng)];
}
