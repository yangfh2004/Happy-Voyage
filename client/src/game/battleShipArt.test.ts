import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { NAVIGATORS, SHIP_TYPES, type ShipStats, type ShipType } from '@happy-voyage/shared';
import { battleShipTexture, broadsideMuzzles, headingFrame, prewarmBattleShips, projectShipPoint, shipGrade, shipModel, shipStyle, SHIP_TEXTURE_SIZE, SHIP_WATERLINE } from './battleShipArt';
import { battleLayout, battleToScreen } from './battleLayout';

const types = ['warship', 'cargo', 'explorer'] as const;
const appearance = (type: ShipType) => ({ type, ...SHIP_TYPES[type] });

describe('oblique ship models', () => {
  it.each(types)('derives %s grades from maximum hull or tonnage, never current damage', (type) => {
    const base = appearance(type);
    expect(shipGrade(base)).toBe(1);
    expect(shipGrade({ ...base, maxDurability: base.maxDurability * 1.16 })).toBe(2);
    expect(shipGrade({ ...base, cargoCapacity: base.cargoCapacity * 1.41 })).toBe(3);
    expect(shipGrade({ ...base, signature: true })).toBe(3);
    expect(shipStyle(base).scale).toBe(.85);
    expect(shipStyle({ ...base, signature: true }).scale).toBe(1.15);
  });

  it('honors exact thresholds and real navigator signature stats', () => {
    const base = appearance('cargo');
    expect(shipGrade({ ...base, maxDurability: 115 })).toBe(1);
    expect(shipGrade({ ...base, maxDurability: 140 })).toBe(2);
    for (const n of NAVIGATORS) {
      const base = appearance(n.signatureShip.type), bonus: Partial<ShipStats> = n.signatureShip.bonus;
      const ship = { ...base, maxDurability: base.maxDurability + (bonus.maxDurability ?? 0), cargoCapacity: base.cargoCapacity + (bonus.cargoCapacity ?? 0), signature: true };
      expect(shipGrade(ship)).toBe(3);
    }
  });

  it('builds nine distinct finite 3D geometries, including gun decks, castles, rigging and tall masts', () => {
    const models = types.flatMap(type => ([1, 2, 3] as const).map(grade => shipModel(type, grade)));
    expect(new Set(models.map(m => m.variant)).size).toBe(9);
    expect(new Set(models.map(m => JSON.stringify(m.faces))).size).toBe(9);
    for (const model of models) {
      expect(model.faces.length).toBeGreaterThan(100);
      expect(model.mastHeight).toBeGreaterThan(60);
      expect(model.faces.some(f => f.material === 'window')).toBe(true);
      expect(model.faces.some(f => f.material === 'cloth')).toBe(true);
      for (let heading = 0; heading < 360; heading += 11.25) for (const face of model.faces) for (const point of face.points) {
        const p = projectShipPoint(point, heading);
        expect(Number.isFinite(p.depth)).toBe(true);
        expect(Math.abs(p.x * 1.5)).toBeLessThan(SHIP_TEXTURE_SIZE / 2 - 2);
        expect(p.y * 1.5 + SHIP_TEXTURE_SIZE * SHIP_WATERLINE.y).toBeGreaterThan(2);
        expect(p.y * 1.5 + SHIP_TEXTURE_SIZE * SHIP_WATERLINE.y).toBeLessThan(SHIP_TEXTURE_SIZE - 2);
      }
    }
    expect(shipModel('warship', 3).faces.filter(f => f.material === 'stripe').length).toBe(36);
    expect(shipModel('cargo', 1)).toBe(shipModel('cargo', 1));
  });

  it('quantizes headings to the nearest of 32 frames with wraparound', () => {
    expect(headingFrame(0)).toBe(0);
    expect(headingFrame(5)).toBe(0);
    expect(headingFrame(6)).toBe(1);
    expect(headingFrame(90)).toBe(8);
    expect(headingFrame(-90)).toBe(24);
    expect(headingFrame(359)).toBe(0);
    expect(headingFrame(720)).toBe(0);
  });

  it('lazily caches textures by variant, grade, color, pirate, signature and heading', () => {
    const scene = { textures: { exists: vi.fn(() => true), createCanvas: vi.fn() } };
    const s = scene as unknown as Phaser.Scene, base = appearance('warship');
    const key = battleShipTexture(s, base, 1);
    expect(battleShipTexture(s, base, 1, false, 4)).toBe(key);
    const keys = [key, battleShipTexture(s, base, 2), battleShipTexture(s, base, 1, true), battleShipTexture(s, { ...base, signature: true }, 1),
      battleShipTexture(s, base, 1, false, 90), battleShipTexture(s, { ...base, maxDurability: 150 }, 1), battleShipTexture(s, appearance('cargo'), 1)];
    expect(new Set(keys).size).toBe(keys.length);
    expect(scene.textures.createCanvas).not.toHaveBeenCalled();
  });

  it('renders a missing frame once, including a water shadow and shaded polygons', () => {
    const ctx = Object.fromEntries(['save', 'restore', 'translate', 'scale', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke'].map(k => [k, vi.fn()]));
    const frame = { width: 1, height: 1, customPivot: false, pivotX: 0, pivotY: 0, setSize: vi.fn(function(this: { width: number; height: number }, width: number, height: number) { this.width = width; this.height = height; }) };
    const texture = { getContext: () => ctx, refresh: vi.fn(), get: () => frame };
    const scene = { textures: { exists: () => false, createCanvas: vi.fn(() => texture) } };
    battleShipTexture(scene as unknown as Phaser.Scene, { ...appearance('cargo'), signature: true }, 0x4488cc, true, 45);
    expect(scene.textures.createCanvas).toHaveBeenCalledWith(expect.stringContaining('galleon'), SHIP_TEXTURE_SIZE, SHIP_TEXTURE_SIZE);
    expect(ctx.fill.mock.calls.length).toBeGreaterThan(100);
    expect(texture.refresh).toHaveBeenCalledOnce();
    expect(frame.setSize).toHaveBeenCalledOnce();
    expect(frame.width).toBeLessThan(SHIP_TEXTURE_SIZE);
    expect(frame.height).toBeLessThan(SHIP_TEXTURE_SIZE);
    expect(frame.customPivot).toBe(true);
    expect(frame.pivotX).toBeGreaterThan(0);
    expect(frame.pivotX).toBeLessThan(1);
    expect(frame.pivotY).toBeGreaterThan(0);
    expect(frame.pivotY).toBeLessThan(1);
    const [, , left, top] = frame.setSize.mock.calls[0] as unknown as number[];
    expect(frame.pivotX * frame.width + left).toBeCloseTo(SHIP_TEXTURE_SIZE * SHIP_WATERLINE.x);
    expect(frame.pivotY * frame.height + top).toBeCloseTo(SHIP_TEXTURE_SIZE * SHIP_WATERLINE.y);
  });

  it('prewarms unique fleets in small batches, handles empty fleets and stops on shutdown', async () => {
    const raf = vi.fn((callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('requestAnimationFrame', raf);
    try {
      const scene = { textures: { exists: vi.fn(() => true) }, sys: { isActive: vi.fn(() => true) } };
      const s = scene as unknown as Phaser.Scene;
      const ship = { ship: appearance('warship'), color: 1, pirate: false };
      await prewarmBattleShips(s, []);
      expect(scene.textures.exists).not.toHaveBeenCalled();
      raf.mockClear();
      await prewarmBattleShips(s, [ship, ship, { ...ship, color: 2 }]);
      expect(scene.textures.exists).toHaveBeenCalledTimes(64);
      expect(raf).toHaveBeenCalledTimes(33);
      scene.textures.exists.mockClear();
      scene.sys.isActive.mockReturnValue(false);
      await prewarmBattleShips(s, [ship]);
      expect(scene.textures.exists).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('projected broadside effects', () => {
  it.each([0, 45, 90, 180, 270])('uses actual gunport positions on the firing side at heading %s', (heading) => {
    const a = heading * Math.PI / 180, normal = { x: -Math.sin(a), y: Math.cos(a) };
    const ship = { ...appearance('warship'), x: 800, y: 450, heading };
    for (const side of [-1, 1]) {
      const muzzles = broadsideMuzzles(ship, { x: ship.x + normal.x * side * 200, y: ship.y + normal.y * side * 200 });
      expect(muzzles).toHaveLength(3);
      for (const muzzle of muzzles) {
        expect(((muzzle.x - ship.x) * normal.x + (muzzle.y - ship.y) * normal.y) * side).toBeGreaterThan(15);
        expect(muzzle.dx * normal.x + muzzle.dy * normal.y).toBeCloseTo(side);
        for (const [w, h] of [[1280, 720], [390, 844]]) {
          const layout = battleLayout(w, h), view = battleToScreen(layout, muzzle), sea = battleToScreen(layout, { ...muzzle, z: 0 });
          expect(view.x).toBeCloseTo(sea.x);
          expect(view.y).toBeLessThan(sea.y);
        }
      }
    }
  });
});
