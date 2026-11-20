import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { createDefaultMap, successors, WORLD } from '@happy-voyage/shared';
import { addNauticalSea, nauticalLayout, nauticalTexture, seaWaves, shipTexture, type SeaMotif } from './nauticalArt';
import { routeEdge } from './routeEdge';

function sceneHarness(cached = false) {
  const graphics = Object.fromEntries(['fillStyle', 'lineStyle', 'fillCircle', 'fillEllipse', 'strokeEllipse', 'fillTriangle', 'strokeCircle', 'lineBetween', 'beginPath', 'moveTo', 'lineTo', 'arc', 'strokePath', 'fillPoints', 'generateTexture', 'destroy'].map((name) => [name, vi.fn().mockReturnThis()]));
  const images: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const scene = {
    textures: { exists: vi.fn(() => cached) },
    add: { graphics: vi.fn(() => graphics), image: vi.fn(() => {
      const image = Object.fromEntries(['setAngle', 'setAlpha', 'setScale', 'setDepth', 'setInteractive'].map((name) => [name, vi.fn().mockReturnThis()]));
      images.push(image);
      return image;
    }) },
    tweens: { add: vi.fn() },
  };
  return { scene: scene as unknown as Phaser.Scene, raw: scene, graphics, images };
}

describe('nautical chart decorations', () => {
  const map = createDefaultMap();
  it('reproduces varied motifs throughout the sea without changing the map', () => {
    const before = structuredClone(map);
    const layout = nauticalLayout(map);
    expect(layout).toEqual(nauticalLayout(map));
    expect(map).toEqual(before);
    expect(layout.length).toBeGreaterThan(15);
    expect(layout.find((item) => item.motif === 'rose')?.radius).toBe(260);
    expect(layout.every((item) => item.radius >= 120)).toBe(true);
    expect(new Set(layout.map((item) => item.motif)).size).toBe(7);
    for (const x of [0, 1]) for (const y of [0, 1]) {
      expect(layout.some((item) => Math.floor(item.x / (WORLD.width / 2)) === x && Math.floor(item.y / (WORLD.height / 2)) === y)).toBe(true);
    }
  });
  it('clears icons, the label envelope, and both straight and curved route edges', () => {
    const edges = map.flatMap((node) => successors(map, node.id).map((to, i) => routeEdge(map, node.id, to, i > 0)));
    for (const item of nauticalLayout(map)) {
      for (const node of map) expect(Math.hypot(item.x - node.x, item.y - node.y - 35) - item.radius).toBeGreaterThanOrEqual(170);
      for (const edge of edges) for (let i = 0; i <= 100; i++) {
        const p = edge.point(i / 100);
        expect(Math.hypot(item.x - p.x, item.y - p.y) - item.radius).toBeGreaterThan(30);
      }
    }
  });
  it('can decorate an empty sea and deterministically generates bounded wave settings', () => {
    expect(nauticalLayout([]).length).toBeGreaterThan(20);
    expect(seaWaves()).toEqual(seaWaves());
    expect(seaWaves()).toHaveLength(110);
    for (const wave of seaWaves()) {
      expect(wave.x).toBeGreaterThan(0); expect(wave.x + wave.drift).toBeLessThan(WORLD.width);
      expect(wave.y).toBeGreaterThan(0); expect(wave.y + 8).toBeLessThan(WORLD.height);
    }
  });
  it.each([false, true])('keeps details non-interactive below routes; reduced motion = %s', (reduced) => {
    const { scene, raw, images } = sceneHarness(true);
    addNauticalSea(scene, map, reduced);
    expect(raw.tweens.add).toHaveBeenCalledTimes(reduced ? 0 : 110);
    for (const image of images) {
      expect(image.setInteractive).not.toHaveBeenCalled();
      expect(image.setDepth.mock.calls[0][0]).toBeLessThan(0);
    }
    for (const image of images.slice(0, nauticalLayout(map).length)) {
      expect(image.setScale.mock.calls[0][0]).toBeGreaterThanOrEqual(1.65);
      expect(image.setAlpha.mock.calls[0][0]).toBeGreaterThanOrEqual(.55);
    }
  });
  it('generates and disposes each motif graphics, reusing cached textures', () => {
    const { scene, raw, graphics } = sceneHarness();
    const motifs: SeaMotif[] = ['rose', 'whale', 'serpent', 'anchor', 'wreck', 'gulls', 'buoy'];
    for (const motif of motifs) expect(nauticalTexture(scene, motif)).toBe(`chart-${motif}`);
    expect(graphics.generateTexture).toHaveBeenCalledTimes(7);
    expect(graphics.destroy).toHaveBeenCalledTimes(7);
    raw.textures.exists.mockReturnValue(true);
    nauticalTexture(scene, 'rose');
    expect(raw.add.graphics).toHaveBeenCalledTimes(7);
  });
});

describe('fleet ship textures', () => {
  it('keeps sails neutral with separate coloured flags, hull trim and a wake', () => {
    const { scene, raw, graphics } = sceneHarness();
    expect(shipTexture(scene, 0xc62632)).toBe('fleet-12985906');
    expect(graphics.fillStyle).toHaveBeenCalledWith(0xfff3ca);
    expect(graphics.fillStyle).toHaveBeenCalledWith(0xc62632);
    expect(graphics.lineStyle).toHaveBeenCalledWith(4, 0xc62632);
    expect(graphics.strokeEllipse).toHaveBeenCalled();
    expect(graphics.destroy).toHaveBeenCalledOnce();
    raw.textures.exists.mockReturnValue(true);
    shipTexture(scene, 0xc62632);
    expect(raw.add.graphics).toHaveBeenCalledOnce();
    expect(shipTexture(scene, 0x23478e)).not.toBe('fleet-12985906');
  });
});
