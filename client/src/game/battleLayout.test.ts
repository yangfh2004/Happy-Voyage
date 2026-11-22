import { describe, expect, it } from 'vitest';
import { battleLayout, battleTapRadius, battleToScreen, isBattleDrag, placeBattleLabel, screenToBattle, type BattleRect } from './battleLayout';

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
    expect(portrait.zoom * 1600).toBeCloseTo(652);
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

  it.each([[844, 390], [844, 329], [390, 844], [1440, 900]])('bounds crowded bottom-edge labels and HP bars away from controls at %sx%s', (width, height) => {
    const { bounds, controlsTop } = battleLayout(width, height);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(controlsTop - 8);
    const occupied: BattleRect[] = [];
    for (let i = 0; i < 10; i++) {
      const ship = { x: bounds.x + bounds.width / 2 + (i % 3 - 1) * 10, y: bounds.y + bounds.height - 3 - i % 2 * 5 };
      const box = placeBattleLabel(bounds, occupied, ship, { width: 70, height: 23 }, 18);
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(box.y).toBeGreaterThanOrEqual(bounds.y);
      expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      for (const other of occupied) expect(box.x >= other.x + other.width || box.x + box.width <= other.x || box.y >= other.y + other.height || box.y + box.height <= other.y).toBe(true);
      occupied.push(box);
    }
  });

  it('flips above a bottom-edge ship and stays bounded when every position is occupied', () => {
    const bounds = { x: 20, y: 86, width: 200, height: 130 };
    const ship = { x: 120, y: 212 };
    const box = placeBattleLabel(bounds, [], ship, { width: 80, height: 23 }, 18);
    expect(box.y + box.height).toBeLessThan(ship.y);
    const crowded = placeBattleLabel(bounds, [bounds], ship, { width: 80, height: 23 }, 18);
    expect(crowded.y).toBeGreaterThanOrEqual(bounds.y);
    expect(crowded.y + crowded.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  });
});
