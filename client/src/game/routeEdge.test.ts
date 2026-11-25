import { describe, expect, it } from 'vitest';
import { createDefaultMap, WORLD, type MapNode } from '@happy-voyage/shared';
import { routeEdge } from './routeEdge';

describe('shortcut geometry', () => {
  const map = Array.from({ length: 70 }, (_, id) => ({ id, x: 5000 + id * 200, y: 5000 } as MapNode));
  Object.assign(map[60], { x: 800, y: WORLD.height - 400 });
  Object.assign(map[61], { x: 440, y: WORLD.height - 400 });
  Object.assign(map[64], { x: 80, y: WORLD.height - 400 });
  Object.assign(map[66], { x: 80, y: 678 });
  Object.assign(map[67], { x: 80, y: 482 });
  Object.assign(map[68], { x: 80, y: 286 });
  Object.assign(map[2], { x: 600, y: 100 });
  Object.assign(map[13], { x: 600, y: 240 });
  it('bows overlapping bottom-lane shortcuts south and return shortcuts west', () => {
    const bottom = routeEdge(map, 60, 64, true);
    const returning = routeEdge(map, 66, 68, true);
    expect(bottom.curved).toBe(true);
    expect(bottom.point(.5).y).toBeGreaterThan(Math.max(map[60].y, map[64].y) + 40);
    expect(returning.curved).toBe(true);
    expect(returning.point(.5).x).toBeLessThan(map[66].x - 40);
    expect(returning.point(.5).x).toBeGreaterThan(0);
  });
  it('gently curves unobstructed shortcuts and keeps main-course edges straight', () => {
    expect(routeEdge(map, 2, 13, true).curved).toBe(true);
    expect(routeEdge(map, 60, 64, false).curved).toBe(false);
  });
  it('keeps every curved default shortcut clear of unrelated stops', () => {
    const islands = createDefaultMap();
    for (const node of islands) {
      for (const target of node.next?.slice(1) ?? []) {
        const edge = routeEdge(islands, node.id, target, true);
        expect(edge.curved).toBe(true);
        for (let i = 0; i <= 100; i++) {
          const p = edge.point(i / 100);
          for (const other of islands) {
            if (other.id !== node.id && other.id !== target) expect(Math.hypot(p.x - other.x, p.y - other.y)).toBeGreaterThan(other.kind === 'sea' ? 30 : 80);
          }
        }
      }
    }
  });
  it('handles coincident endpoints without invalid coordinates', () => {
    const same = [{ id: 0, x: 0, y: 0 }, { id: 1, x: 0, y: 0 }] as MapNode[];
    expect(routeEdge(same, 0, 1, true).point(.5)).toEqual({ x: 0, y: 0 });
  });
});
