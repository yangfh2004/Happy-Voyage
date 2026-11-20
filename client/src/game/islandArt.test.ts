import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { createDefaultMap } from '@happy-voyage/shared';
import { islandLandscape, islandTexture } from './islandArt';

describe('seeded island art', () => {
  const islands = createDefaultMap().filter((node) => node.kind === 'island');
  it('makes forty distinct reproducible coastlines and varied terrain', () => {
    const landscapes = islands.map(islandLandscape);
    expect(landscapes).toEqual(islands.map(islandLandscape));
    expect(new Set(landscapes.map((landscape) => JSON.stringify(landscape.coast))).size).toBe(40);
    expect(new Set(landscapes.map((landscape) => landscape.river)).size).toBe(2);
    expect(new Set(landscapes.map((landscape) => landscape.palette[1])).size).toBe(3);
    for (const { coast, terrain } of landscapes) {
      expect(terrain.length).toBeGreaterThan(12);
      for (const { x, y } of coast) {
        expect(x).toBeGreaterThan(5); expect(x).toBeLessThan(155);
        expect(y).toBeGreaterThan(5); expect(y).toBeLessThan(147);
      }
    }
  });
  it('uses cached textures without allocating graphics again', () => {
    const graphics = vi.fn();
    const scene = { textures: { exists: vi.fn(() => true) }, add: { graphics } } as unknown as Phaser.Scene;
    expect(islandTexture(scene, islands[0])).toBe(`island-${islands[0].id}-${islands[0].specialty}`);
    expect(graphics).not.toHaveBeenCalled();
  });
  it('handles an island with no specialty', () => {
    const { specialty: _, ...node } = islands[0];
    expect(islandLandscape(node).coast).toHaveLength(32);
  });
});
