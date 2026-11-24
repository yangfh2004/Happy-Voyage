import { describe, expect, it } from 'vitest';
import { BATTLE_FIELD } from '@happy-voyage/shared';
import { battleLayout, battleTapRadius, battleToScreen, isBattleDrag, pickBattleShip, placeBattleLabel, screenToBattle, type BattleRect } from './battleLayout';

describe('battlefield layout', () => {
  it.each([
    ...[568, 640, 844, 1024, 1280].flatMap(width => [260, 300, 390, 449, 450, 720].map(height => [width, height])),
    [390, 844],
  ])('leaves a pressable field between the HUD and controls at %sx%s', (width, height) => {
    const layout = battleLayout(width, height);
    const { bounds } = layout;
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.y).toBeGreaterThanOrEqual(layout.hudBottom);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(layout.controlsTop - 8 + .001);
    expect(bounds.y + bounds.height / 2).toBeGreaterThanOrEqual(layout.hudBottom);
    expect(bounds.y + bounds.height / 2).toBeLessThan(layout.controlsTop);
    expect(layout.hudBottom).toBe(height < 450 ? 108 : 140);
    expect(height - layout.controlsTop).toBe(width < 650 ? 112 : 64);
  });

  it.each([[390, 844], [1440, 900], [844, 390], [600, 600]])('round-trips coordinates at %sx%s with the whole field between HUD and controls', (width, height) => {
    const layout = battleLayout(width, height);
    for (const point of [{ x: 0, y: 0 }, { x: BATTLE_FIELD.width, y: BATTLE_FIELD.height }, { x: 123, y: 678 }, { x: BATTLE_FIELD.width / 2, y: BATTLE_FIELD.height / 2 }]) {
      const screen = battleToScreen(layout, point);
      expect(screen.x).toBeGreaterThanOrEqual(-.001);
      expect(screen.x).toBeLessThanOrEqual(width + .001);
      expect(screen.y).toBeGreaterThanOrEqual(layout.hudBottom - .001);
      expect(screen.y).toBeLessThanOrEqual(layout.controlsTop - 8 + .001);
      const back = screenToBattle(layout, screen);
      expect(back.x).toBeCloseTo(point.x);
      expect(back.y).toBeCloseTo(point.y);
    }
  });

  it('puts attackers below defenders in portrait and preserves landscape orientation', () => {
    const portrait = battleLayout(390, 844), landscape = battleLayout(1440, 900);
    const attacker = { x: BATTLE_FIELD.width * .1, y: BATTLE_FIELD.height / 2 };
    const defender = { x: BATTLE_FIELD.width * .9, y: BATTLE_FIELD.height / 2 };
    expect(portrait.angle).toBe(0);
    expect(battleToScreen(portrait, attacker).y).toBeGreaterThan(battleToScreen(portrait, defender).y);
    expect(portrait.bounds.height).toBeCloseTo(portrait.zoom * BATTLE_FIELD.width * Math.SQRT1_2);
    expect(landscape.angle).toBe(0);
    expect(battleToScreen(landscape, attacker).x).toBeLessThan(battleToScreen(landscape, defender).x);
  });

  it('shrinks portrait G2 hulls by 1.5 without stretching the field', () => {
    const layout = battleLayout(390, 844);
    expect(125 * Math.SQRT1_2 * layout.zoom * layout.shipScale).toBeCloseTo(70 / 1.5);
    expect(layout.bounds.width / layout.bounds.height).toBeCloseTo(BATTLE_FIELD.height / (BATTLE_FIELD.width * Math.SQRT1_2));
  });

  it.each([[390, 844], [1280, 720]])('projects height screen-up independently of orientation at %sx%s', (width, height) => {
    const layout = battleLayout(width, height);
    const sea = battleToScreen(layout, { x: 500, y: 400 });
    const mast = battleToScreen(layout, { x: 500, y: 400, z: 100 });
    expect(mast.x).toBe(sea.x);
    expect(sea.y - mast.y).toBeCloseTo(100 * Math.SQRT1_2 * layout.zoom);
  });

  it.each([.1, .409, 1, 2])('keeps a 44 screen-pixel tap diameter at scale %s', (zoom) => {
    expect(battleTapRadius(zoom) * zoom * 2).toBeGreaterThanOrEqual(44);
  });

  it.each([[390, 844], [844, 390]])('keeps a 44 CSS px target on the expanded field at %sx%s', (width, height) => {
    const layout = battleLayout(width, height);
    const water = battleToScreen(layout, { x: BATTLE_FIELD.width / 2, y: BATTLE_FIELD.height / 2 });
    const radius = battleTapRadius(layout.zoom) * layout.zoom;
    const ship = { ...water, id: 1, depth: water.y, radius, bounds: { ...water, width: 1, height: 1 } };
    expect(radius * 2).toBeGreaterThanOrEqual(44);
    expect(pickBattleShip({ x: water.x - 22, y: water.y }, [ship])).toBe(ship);
    expect(pickBattleShip({ x: water.x, y: water.y - 22 }, [ship])).toBe(ship);
    expect(pickBattleShip({ x: water.x - radius - 1, y: water.y }, [ship])).toBeUndefined();
  });

  it('treats finger drift as a tap independently of field scale or rotation', () => {
    for (const [width, height] of [[390, 844], [844, 390]]) {
      const start = battleToScreen(battleLayout(width, height), { x: BATTLE_FIELD.width / 2, y: BATTLE_FIELD.height / 2 });
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

describe('projected ship hit targets', () => {
  const ship = { id: 1, x: 150, y: 250, depth: 250, radius: 10, bounds: { x: 110, y: 140, width: 80, height: 120 } };

  it('hits the sails and castle well above the waterline in both orientations', () => {
    for (const [width, height] of [[1280, 720], [390, 844]]) {
      const layout = battleLayout(width, height);
      const water = battleToScreen(layout, { x: BATTLE_FIELD.width / 2, y: BATTLE_FIELD.height / 2 });
      const mast = battleToScreen(layout, { x: BATTLE_FIELD.width / 2, y: BATTLE_FIELD.height / 2, z: 180 });
      const candidate = { ...ship, ...water, bounds: { x: water.x - 30, y: mast.y - 5, width: 60, height: water.y - mast.y + 15 } };
      expect(Math.hypot(mast.x - water.x, mast.y - water.y)).toBeGreaterThan(22);
      expect(pickBattleShip(mast, [candidate])).toBe(candidate);
    }
  });

  it('keeps the 44 px minimum even for small sprites and rejects empty water', () => {
    const small = { ...ship, bounds: { x: 148, y: 248, width: 4, height: 4 } };
    expect(pickBattleShip({ x: 172, y: 250 }, [small])).toBe(small);
    expect(pickBattleShip({ x: 173, y: 250 }, [small])).toBeUndefined();
    expect(pickBattleShip({ x: 0, y: 0 }, [ship])).toBeUndefined();
    expect(pickBattleShip({ x: 150, y: 180 }, [])).toBeUndefined();
  });

  it('prefers visible sprite hits, then frontmost ships and the nearest at equal depth', () => {
    const front = { ...ship, id: 2, y: 260, depth: 260 };
    expect(pickBattleShip({ x: 150, y: 180 }, [ship, front])).toBe(front);
    const near = { ...front, x: 155 };
    expect(pickBattleShip({ x: 157, y: 180 }, [front, near])).toBe(near);
    const padded = { ...front, bounds: { x: 145, y: 250, width: 10, height: 10 }, y: 210 };
    expect(pickBattleShip({ x: 150, y: 200 }, [padded, ship])).toBe(ship);
  });
});
