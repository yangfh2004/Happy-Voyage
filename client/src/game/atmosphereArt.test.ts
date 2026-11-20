import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { WORLD, type GameState } from '@happy-voyage/shared';
import { CHART_DEPTH, drawAtmosphere } from './atmosphereArt';

function graphics() {
  return Object.fromEntries(['clear', 'fillStyle', 'fillRect', 'fillEllipse', 'lineStyle', 'lineBetween', 'fillCircle'].map(key => [key, vi.fn().mockReturnThis()]));
}

describe('chart atmosphere', () => {
  it('keeps labels and gold popups above every atmospheric effect', () => {
    expect(CHART_DEPTH.labels).toBeGreaterThan(CHART_DEPTH.atmosphere);
    expect(CHART_DEPTH.popup).toBeGreaterThan(CHART_DEPTH.labels);
  });
  it.each([null, 1, 2, 3, 4, 5, NaN])('draws a deterministic layer for round %s', round => {
    const state = round === null ? null : { round, market: { stock: {}, repairDemandThroughRound: 0 } } as GameState;
    const a = graphics();
    const b = graphics();
    drawAtmosphere(a as unknown as Phaser.GameObjects.Graphics, state, 0);
    drawAtmosphere(b as unknown as Phaser.GameObjects.Graphics, state, 0);
    expect(a.clear).toHaveBeenCalledOnce();
    for (const key of Object.keys(a)) expect(a[key].mock.calls).toEqual(b[key].mock.calls);
  });
  it('renders storm rain and clouds on the same sub-label layer', () => {
    const g = graphics();
    drawAtmosphere(g as unknown as Phaser.GameObjects.Graphics, { round: 4, market: { stock: {}, repairDemandThroughRound: 4 } } as GameState, 0);
    expect(g.fillRect).toHaveBeenCalledTimes(2);
    expect(g.fillRect).toHaveBeenCalledWith(-WORLD.width * 4, -WORLD.height * 4, WORLD.width * 9, WORLD.height * 9);
    expect(g.fillEllipse).toHaveBeenCalled();
    expect(g.lineBetween).toHaveBeenCalledTimes(64);
  });
});
