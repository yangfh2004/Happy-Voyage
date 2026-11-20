import { describe, expect, it } from 'vitest';
import { atmosphere } from './atmosphere';

describe('atmosphere', () => {
  const state = (round: number, repairDemandThroughRound = 0) => ({ round, market: { stock: {} as never, repairDemandThroughRound } });
  it('has a calm daylight title screen', () => {
    expect(atmosphere(null)).toEqual({ phase: 'day', weather: 'clear' });
  });
  it('cycles identically without mutating state', () => {
    expect([1, 2, 3, 4, 5].map(round => atmosphere(state(round)).phase)).toEqual(['dawn', 'day', 'dusk', 'night', 'dawn']);
    const input = state(3);
    const copy = structuredClone(input);
    expect(atmosphere(input)).toEqual({ phase: 'dusk', weather: 'rain' });
    expect(atmosphere(input)).toEqual(atmosphere(copy));
    expect(input).toEqual(copy);
    expect(atmosphere(state(5)).weather).toBe('fog');
  });
  it('uses the market storm aftermath and expires with it', () => {
    expect(atmosphere(state(4, 4)).weather).toBe('storm');
    expect(atmosphere(state(5, 4)).weather).toBe('fog');
  });
  it('normalizes invalid rounds', () => {
    for (const round of [NaN, Infinity, -1, 0]) expect(atmosphere(state(round))).toEqual(atmosphere(state(1)));
  });
});
