import { expect, it } from 'vitest';
import { spinCompass } from './compass';

it('preserves the triangular movement distribution from 2 through 12', () => {
  const counts = Array<number>(11).fill(0);
  for (let slot = 0; slot < 36; slot++) {
    const steps = spinCompass(() => (slot + 0.5) / 36);
    counts[steps - 2]++;
  }
  expect(counts).toEqual([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]);
});
