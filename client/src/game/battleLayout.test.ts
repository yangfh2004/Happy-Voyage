import { describe, expect, it } from 'vitest';
import { battleLayout, battleTapRadius, battleToScreen, isBattleDrag, screenToBattle } from './battleLayout';

describe('battlefield layout', () => {
  it.each([[390, 844], [1440, 900], [844, 390], [600, 600]])('round-trips coordinates at %sx%s with the whole field between HUD and controls', (width, height) => {
    const layout = battleLayout(width, height);
    for (const point of [{ x: 0, y: 0 }, { x: 1600, y: 900 }, { x: 123, y: 678 }, { x: 800, y: 450 }]) {
      const screen = battleToScreen(layout, point);
      expect(screen.x).toBeGreaterThanOrEqual(-.001);
      expect(screen.x).toBeLessThanOrEqual(width + .001);
      expect(screen.y).toBeGreaterThanOrEqual(86 - .001);
      expect(screen.y).toBeLessThanOrEqual(height - 104 + .001);
      const back = screenToBattle(layout, screen);
      expect(back.x).toBeCloseTo(point.x);
      expect(back.y).toBeCloseTo(point.y);
    }
  });

  it('puts attackers below defenders in portrait and preserves landscape orientation', () => {
    const portrait = battleLayout(390, 844), landscape = battleLayout(1440, 900);
    expect(portrait.angle).toBe(-90);
    expect(battleToScreen(portrait, { x: 160, y: 450 }).y).toBeGreaterThan(battleToScreen(portrait, { x: 1440, y: 450 }).y);
    expect(portrait.zoom * 1600).toBeCloseTo(654);
    expect(landscape.angle).toBe(0);
    expect(battleToScreen(landscape, { x: 160, y: 450 }).x).toBeLessThan(battleToScreen(landscape, { x: 1440, y: 450 }).x);
  });

  it.each([.1, .409, 1, 2])('keeps a 44 screen-pixel tap diameter at scale %s', (zoom) => {
    expect(battleTapRadius(zoom) * zoom * 2).toBeGreaterThanOrEqual(44);
  });

  it('treats finger drift as a tap independently of field scale or rotation', () => {
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      const start = battleToScreen(battleLayout(width, height), { x: 200, y: 450 });
      expect(isBattleDrag(start, { x: start.x + 5, y: start.y })).toBe(false);
      expect(isBattleDrag(start, { x: start.x, y: start.y + 14 })).toBe(false);
      expect(isBattleDrag(start, { x: start.x + 15, y: start.y })).toBe(true);
      expect(isBattleDrag(start, { x: start.x + 11, y: start.y + 11 })).toBe(true);
    }
  });
});
