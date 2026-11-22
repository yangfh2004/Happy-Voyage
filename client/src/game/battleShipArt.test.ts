import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { battleShipTexture, broadsideMuzzles } from './battleShipArt';

function harness(cached = false) {
  const graphics = Object.fromEntries(['fillStyle', 'lineStyle', 'fillPoints', 'strokePoints', 'lineBetween', 'fillRoundedRect', 'strokeRect', 'fillRect', 'fillEllipse', 'fillCircle', 'fillTriangle', 'generateTexture', 'destroy'].map((name) => [name, vi.fn().mockReturnThis()]));
  const scene = { textures: { exists: vi.fn(() => cached) }, add: { graphics: vi.fn(() => graphics) } };
  return { scene: scene as unknown as Phaser.Scene, raw: scene, graphics };
}

describe('top-down battle ship art', () => {
  it.each(['warship', 'cargo', 'explorer'] as const)('draws a %s with a right-facing pointed bow, square stern and wooden deck', (type) => {
    const { scene, graphics } = harness();
    battleShipTexture(scene, type, 0x427bb4);
    const hull = graphics.fillPoints.mock.calls[0][0] as { x: number; y: number }[];
    expect(hull[0].x).toBe(hull.at(-1)!.x);
    expect(hull[0].y).toBeLessThan(96);
    expect(hull.at(-1)!.y).toBeGreaterThan(96);
    const bow = hull.filter((p) => p.x === Math.max(...hull.map((p) => p.x)));
    expect(bow).toEqual([{ x: expect.any(Number), y: 96 }]);
    expect(graphics.fillStyle).toHaveBeenCalledWith(0xb18a58);
    expect(graphics.fillStyle).toHaveBeenCalledWith(0x427bb4);
    expect(graphics.generateTexture).toHaveBeenCalledWith(expect.stringContaining(type), 256, 192);
    expect(graphics.destroy).toHaveBeenCalledOnce();
    expect(graphics.fillCircle).toHaveBeenCalledTimes(type === 'warship' ? 3 : 2);
  });

  it('makes cargo broad and explorers slim, with more warship gunports', () => {
    const drawings = (['warship', 'cargo', 'explorer'] as const).map((type) => {
      const { scene, graphics } = harness(); battleShipTexture(scene, type, 0xffffff);
      const hull = graphics.fillPoints.mock.calls[0][0] as { y: number }[];
      return { beam: Math.max(...hull.map((p) => p.y)) - Math.min(...hull.map((p) => p.y)), lines: graphics.lineBetween.mock.calls.length };
    });
    expect(drawings[1].beam).toBeGreaterThan(drawings[0].beam);
    expect(drawings[0].beam).toBeGreaterThan(drawings[2].beam);
    expect(drawings[0].lines).toBeGreaterThan(drawings[2].lines);
  });

  it('uses black/red pirate sails and gold signature trim without recolouring wood', () => {
    const { scene, graphics } = harness();
    battleShipTexture(scene, 'warship', 0x335599, true, true);
    expect(graphics.fillStyle).toHaveBeenCalledWith(0x24232a);
    expect(graphics.lineStyle).toHaveBeenCalledWith(3, 0xb54037);
    expect(graphics.lineStyle).toHaveBeenCalledWith(3, 0xf4cf70);
    expect(graphics.fillStyle).toHaveBeenCalledWith(0xb18a58);
  });

  it('reuses textures without allocating graphics and keys every visual variant', () => {
    const { scene, raw } = harness(true);
    const keys = [battleShipTexture(scene, 'warship', 1), battleShipTexture(scene, 'explorer', 1), battleShipTexture(scene, 'cargo', 1),
      battleShipTexture(scene, 'warship', 2), battleShipTexture(scene, 'warship', 1, true), battleShipTexture(scene, 'warship', 1, false, true)];
    expect(new Set(keys).size).toBe(keys.length);
    expect(raw.add.graphics).not.toHaveBeenCalled();
  });
});

describe('broadside effects', () => {
  it.each([0, 90, 180, 270])('puts muzzle puffs on the firing side at heading %s', (heading) => {
    const a = heading * Math.PI / 180;
    const normal = { x: -Math.sin(a), y: Math.cos(a) };
    for (const side of [-1, 1]) {
      const muzzles = broadsideMuzzles({ x: 200, y: 300, heading, type: 'warship' }, { x: 200 + normal.x * side * 200, y: 300 + normal.y * side * 200 });
      expect(muzzles).toHaveLength(3);
      for (const muzzle of muzzles) {
        expect(((muzzle.x - 200) * normal.x + (muzzle.y - 300) * normal.y) * side).toBeGreaterThan(20);
        expect(muzzle.dx * normal.x + muzzle.dy * normal.y).toBeCloseTo(side);
      }
    }
  });
});
