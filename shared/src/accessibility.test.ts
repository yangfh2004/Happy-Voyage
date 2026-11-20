import { describe, expect, it } from 'vitest';
import { chartIdentity } from './accessibility';
import { NATIONS } from './nations';

describe('chart identity', () => {
  it('keeps the original player colors and does not add markers by default', () => {
    expect(chartIdentity({ id: 0, color: 0x123456 }, false)).toEqual({ color: 0x123456, badge: null });
  });

  it('assigns every seat a different palette color and a non-color identifier', () => {
    const entries = NATIONS.map(({ color }, id) => chartIdentity({ id, color }, true));
    expect(new Set(entries.map(({ color }) => color)).size).toBe(NATIONS.length);
    expect(entries.map(({ badge }) => badge)).toEqual(NATIONS.map((_, id) => String(id + 1)));
    expect(chartIdentity({ id: 2, color: 0 }, true)).toEqual(entries[2]);
  });
});
