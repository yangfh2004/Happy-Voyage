import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultMap } from '@happy-voyage/shared';
import { harbourLandscape, harbourTexture, PORT_FLAGS } from './harbourArt';

function artScene() {
  const cache = new Set<string>(), traces = new Map<string, unknown[]>();
  let commands: unknown[] = [];
  const graphics: Record<string, ReturnType<typeof vi.fn>> = Object.fromEntries(['fillStyle', 'fillPoints', 'lineStyle', 'strokePoints', 'lineBetween', 'fillEllipse', 'fillCircle', 'fillRect', 'strokeRect'].map(name => [name, vi.fn((...args: unknown[]) => { commands.push([name, ...args]); return graphics; })]));
  graphics.generateTexture = vi.fn((key: string, width: number, height: number) => { traces.set(key, [...commands, [width, height]]); cache.add(key); });
  graphics.destroy = vi.fn(() => { commands = []; });
  const scene = { textures: { exists: (key: string) => cache.has(key) }, add: { graphics: vi.fn(() => graphics) } };
  return { scene: scene as unknown as Phaser.Scene, raw: scene, traces };
}

describe('seeded harbour towns', () => {
  const ports = createDefaultMap().filter(n => n.kind === 'port');
  it('renders distinct reproducible ports with the national flag palette without mutating the map', () => {
    const a = artScene(), b = artScene(), before = structuredClone(ports);
    for (const node of ports) {
      const key = harbourTexture(a.scene, node);
      harbourTexture(b.scene, node);
      expect(a.traces.get(key)?.at(-1)).toEqual([160, 152]);
      for (const color of PORT_FLAGS[node.nation!]) expect(a.traces.get(key)).toContainEqual(['fillStyle', color]);
      const { coast, houses } = harbourLandscape(node);
      expect(houses).toHaveLength(7);
      for (const p of coast) {
        expect(p.x).toBeGreaterThan(8); expect(p.x).toBeLessThan(152);
        expect(p.y).toBeGreaterThan(8); expect(p.y).toBeLessThan(126);
      }
    }
    expect(new Set([...a.traces.values()].map(trace => JSON.stringify(trace))).size).toBe(ports.length);
    expect(a.traces).toEqual(b.traces);
    expect(ports).toEqual(before);
  });

  it('caches each texture and renders unknown nations with a neutral flag', () => {
    const h = artScene(), key = harbourTexture(h.scene, ports[0]);
    expect(harbourTexture(h.scene, ports[0])).toBe(key);
    expect(h.raw.add.graphics).toHaveBeenCalledOnce();
    const unknown = harbourTexture(h.scene, { ...ports[0], id: 99, nation: undefined });
    expect(h.traces.get(unknown)).toContainEqual(['fillStyle', 0xf4ead1]);
    expect(h.raw.add.graphics).toHaveBeenCalledTimes(2);
  });
});
