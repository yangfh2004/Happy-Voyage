import { describe, expect, it } from 'vitest';
import { createDefaultMap, MIN_NODE_SPACING, WORLD } from './map';
import { spinCompass } from './compass';
import { GAMEPLAY_TUNING } from './gameplayTuning';
import { successors, walkPath, windExit, WIND_DIRECTIONS } from './graph';

describe('organic archipelagos', () => {
  const map = createDefaultMap();
  it('is deterministic, independently allocated and keeps all stops and nations', () => {
    const another = createDefaultMap();
    expect(another).toEqual(map);
    expect(another[0]).not.toBe(map[0]);
    expect(map).toHaveLength(143);
    expect(map.filter((node) => node.kind === 'island')).toHaveLength(40);
    expect(map.filter((node) => node.kind === 'port')).toHaveLength(10);
    expect(map.filter((node) => node.kind === 'special')).toHaveLength(7);
    expect(map.filter((node) => node.kind === 'event')).toHaveLength(13);
    const sea = map.filter((node) => node.kind === 'sea');
    expect(sea).toHaveLength(73);
    for (const node of sea) {
      expect(Object.keys(node).sort()).toEqual(['chineseName', 'id', 'kind', 'name', 'x', 'y']);
      expect(successors(map, node.id)).toEqual([(node.id + 1) % map.length]);
    }
    for (let i = 0; i < map.length; i++) expect(map[i].id).toBe(i);
  });
  it('leaves room for icons and labels within the sea', () => {
    for (const a of map) {
      expect(a.x).toBeGreaterThan(100);
      expect(a.y).toBeGreaterThan(100);
      expect(a.x).toBeLessThan(WORLD.width - 100);
      expect(a.y).toBeLessThan(WORLD.height - 100);
      for (const b of map) {
        if (a.id === b.id) continue;
        const spacing = a.kind === 'sea' || b.kind === 'sea' ? 85 : MIN_NODE_SPACING;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(spacing);
      }
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
  it('keeps shortcuts local in distance and route order', () => {
    const stops = map.filter((node) => node.kind !== 'sea');
    const lengths = stops.map((node, i) => Math.hypot(node.x - stops[(i + 1) % stops.length].x, node.y - stops[(i + 1) % stops.length].y)).sort((a, b) => a - b);
    const typical = lengths[Math.floor(lengths.length / 2)];
    for (const node of map) {
      for (const id of successors(map, node.id).slice(1)) {
        expect(Math.hypot(node.x - map[id].x, node.y - map[id].y)).toBeLessThanOrEqual(typical * 2.5);
        const steps = (id - node.id + map.length) % map.length;
        expect(steps).toBeGreaterThanOrEqual(2);
        expect(steps).toBeLessThanOrEqual(18);
        const from = stops.indexOf(node), to = stops.indexOf(map[id]);
        expect((to - from + stops.length) % stops.length).toBeLessThanOrEqual(9);
      }
    }
  });
  it('keeps main-route step lengths comparable across short and long crossings', () => {
    for (const node of map) {
      const next = map[successors(map, node.id)[0]];
      const distance = Math.hypot(next.x - node.x, next.y - node.y);
      expect(distance).toBeGreaterThanOrEqual(190);
      expect(distance).toBeLessThanOrEqual(380);
    }
  });
  it('ends about half of seeded compass moves on blank sea, including wind shortcuts', () => {
    const { windMinTurns, windExtraTurns } = GAMEPLAY_TUNING.map;
    let turns = 0, blankLandings = 0;
    for (let seed = 1; seed <= 16; seed++) {
      let state = seed;
      const rng = () => (state = state * 16807 % 2147483647) / 2147483647;
      const nextWindDuration = () => windMinTurns + Math.floor(rng() * (1 + windExtraTurns));
      let wind = WIND_DIRECTIONS[Math.floor(rng() * WIND_DIRECTIONS.length)];
      let turnsLeft = nextWindDuration();
      const positions = map.filter(node => node.kind === 'port').map(node => node.id);
      for (let turn = 0; turn < 10000; turn++) {
        const seat = turn % positions.length;
        const landing = walkPath(map, positions[seat], spinCompass(rng), wind).at(-1)!;
        positions[seat] = landing;
        if (map[landing].kind === 'sea') blankLandings++;
        turns++;
        if (--turnsLeft === 0) {
          const choices = WIND_DIRECTIONS.filter(direction => direction !== wind);
          wind = choices[Math.floor(rng() * choices.length)];
          turnsLeft = nextWindDuration();
        }
      }
    }
    expect(blankLandings / turns).toBeGreaterThanOrEqual(0.45);
    expect(blankLandings / turns).toBeLessThanOrEqual(0.55);
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
          expect(Math.hypot(p.x - node.x - t * dx, p.y - node.y - t * dy)).toBeGreaterThan(p.kind === 'sea' ? 45 : 85);
        }
      }
    }
    const reached = new Set<number>();
    let id = 0;
    do { reached.add(id); id = successors(map, id)[0]; } while (id !== 0);
    expect(reached.size).toBe(map.length);
  });
});
