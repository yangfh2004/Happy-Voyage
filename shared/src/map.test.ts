import { describe, expect, it } from 'vitest';
import { createDefaultMap, MIN_NODE_SPACING, WORLD } from './map';
import { successors, windExit, WIND_DIRECTIONS } from './graph';

describe('organic archipelagos', () => {
  const map = createDefaultMap();
  it('is deterministic, independently allocated and keeps all stops and nations', () => {
    const another = createDefaultMap();
    expect(another).toEqual(map);
    expect(another[0]).not.toBe(map[0]);
    expect(map).toHaveLength(70);
    expect(map.filter((node) => node.kind === 'island')).toHaveLength(40);
    expect(map.filter((node) => node.kind === 'port')).toHaveLength(10);
    for (let i = 0; i < map.length; i++) expect(map[i].id).toBe(i);
  });
  it('leaves room for icons and labels within the sea', () => {
    for (const a of map) {
      expect(a.x).toBeGreaterThan(100);
      expect(a.y).toBeGreaterThan(100);
      expect(a.x).toBeLessThan(WORLD.width - 100);
      expect(a.y).toBeLessThan(WORLD.height - 100);
      for (const b of map) if (a.id !== b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(MIN_NODE_SPACING);
    }
  });
  it('gives every fork two distinct cardinal headings, each selectable by wind', () => {
    const heading = (dx: number, dy: number) => Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'E' : 'W' : dy > 0 ? 'S' : 'N';
    const forks = map.filter((node) => successors(map, node.id).length > 1);
    expect(forks).toHaveLength(9);
    const shortcutWinds = new Set<string>();
    for (const node of forks) {
      const exits = successors(map, node.id);
      const choices = WIND_DIRECTIONS.map((wind) => windExit(map, node.id, wind));
      expect(new Set(choices)).toEqual(new Set(exits));
      expect(new Set(exits.map((id) => heading(map[id].x - node.x, map[id].y - node.y))).size).toBe(2);
      WIND_DIRECTIONS.forEach((wind, i) => { if (choices[i] === exits[1]) shortcutWinds.add(wind); });
    }
    expect(shortcutWinds).toEqual(new Set(WIND_DIRECTIONS));
  });
  it('keeps edges clear of other stops and a complete home-port ring', () => {
    for (const node of map) {
      expect(successors(map, node.id)[0]).toBe((node.id + 1) % map.length);
      for (const id of successors(map, node.id)) {
        const b = map[id];
        const dx = b.x - node.x;
        const dy = b.y - node.y;
        const length = dx * dx + dy * dy;
        for (const p of map) {
          if (p.id === node.id || p.id === id) continue;
          const t = Math.max(0, Math.min(1, ((p.x - node.x) * dx + (p.y - node.y) * dy) / length));
          expect(Math.hypot(p.x - node.x - t * dx, p.y - node.y - t * dy)).toBeGreaterThan(85);
        }
      }
    }
    const reached = new Set<number>();
    let id = 0;
    do { reached.add(id); id = successors(map, id)[0]; } while (id !== 0);
    expect(reached.size).toBe(map.length);
  });
});
