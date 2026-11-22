import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { createDefaultMap, SEA_EVENT_NAMES, ZH, type MapNode, type SpecialKind, type EventKind } from '@happy-voyage/shared';
import { specialIslandTexture } from './specialIslandArt';
import { BootScene } from './scenes/BootScene';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

function artScene() {
  const cache = new Set<string>();
  const traces = new Map<string, unknown[]>();
  let commands: unknown[] = [];
  const graphics: Record<string, ReturnType<typeof vi.fn>> = Object.fromEntries([
    'fillStyle', 'fillPoints', 'lineStyle', 'strokePoints', 'fillRoundedRect', 'strokeRoundedRect', 'strokeRect',
    'lineBetween', 'fillEllipse', 'strokeEllipse', 'fillCircle', 'strokeCircle', 'fillTriangle', 'fillRect',
    'beginPath', 'arc', 'strokePath',
  ].map(name => [name, vi.fn((...args: unknown[]) => { commands.push([name, ...args]); return graphics; })]));
  graphics.clear = vi.fn(() => { commands = []; return graphics; });
  graphics.destroy = vi.fn(() => { commands = []; });
  graphics.generateTexture = vi.fn((key: string, ...size: unknown[]) => {
    traces.set(key, [...commands, size]); cache.add(key); return graphics;
  });
  const scene = { textures: { exists: (key: string) => cache.has(key) }, add: { graphics: vi.fn(() => graphics) }, scene: { start: vi.fn() } };
  return { scene: scene as unknown as Phaser.Scene, raw: scene, traces, graphics };
}

describe('themed special stops', () => {
  const specials = (Object.keys(ZH.specials) as SpecialKind[]).map((special, id): MapNode => ({ id, x: 0, y: 0, name: special, kind: 'special', special }));
  const events = (Object.keys(SEA_EVENT_NAMES) as EventKind[]).map((event, id): MapNode => ({ id: id + 7, x: 0, y: 0, name: event, kind: 'event', event }));
  const nodes = [...specials, ...events];

  it('draws a distinct reproducible image for all seven special and twelve encounter kinds', () => {
    const first = artScene(), second = artScene();
    const before = structuredClone(nodes);
    const keys = nodes.map(node => specialIslandTexture(first.scene, node));
    expect(keys).toHaveLength(19);
    expect(new Set(keys).size).toBe(19);
    expect(new Set([...first.traces.values()].map(trace => JSON.stringify(trace))).size).toBe(19);
    nodes.forEach(node => specialIslandTexture(second.scene, node));
    expect(first.traces).toEqual(second.traces);
    expect(nodes).toEqual(before);
    expect(first.graphics.destroy).toHaveBeenCalledTimes(19);
    for (const key of keys) expect(first.traces.get(key)?.at(-1)).toEqual([160, 152]);
  });

  it('reuses cached textures and gives incomplete stops a neutral island without throwing', () => {
    const { scene, raw, traces } = artScene();
    const key = specialIslandTexture(scene, specials[0]);
    expect(specialIslandTexture(scene, specials[0])).toBe(key);
    expect(raw.add.graphics).toHaveBeenCalledOnce();
    const missing = specialIslandTexture(scene, { id: 100, kind: 'special', name: 'Unknown', x: 0, y: 0 });
    expect(traces.get(missing)?.length).toBeGreaterThan(4);
  });

  it('caches every default special/encounter texture before starting the ocean', () => {
    const { raw, traces } = artScene();
    const boot = Object.assign(new BootScene(), raw);
    boot.create();
    for (const node of createDefaultMap().filter(node => node.kind === 'special' || node.kind === 'event')) {
      expect(traces.has(`stop-${node.kind}-${node.special ?? node.event}-${node.id}`)).toBe(true);
    }
    for (const node of createDefaultMap().filter(node => node.kind === 'port')) expect(traces.has(`harbour-${node.id}-${node.nation}`)).toBe(true);
    expect(raw.scene.start).toHaveBeenCalledWith('Ocean');
  });
});
