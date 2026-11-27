import { describe, expect, it } from 'vitest';
import { createDefaultMap, MIN_NODE_SPACING, WORLD } from './map';
import { successors, walkPath, windExit, WIND_DIRECTIONS } from './graph';

describe('organic archipelagos', () => {
  const map = createDefaultMap();
  it('is deterministic, independently allocated and keeps all stops and nations', () => {
    const another = createDefaultMap();
    expect(another).toEqual(map);
    expect(another[0]).not.toBe(map[0]);
    expect(map).toHaveLength(107);
    expect(map.filter((node) => node.kind === 'island')).toHaveLength(40);
    expect(map.filter((node) => node.kind === 'port')).toHaveLength(10);
    expect(map.filter((node) => node.kind === 'special')).toHaveLength(9);
    expect(map.filter((node) => node.special === 'nightless').map((node) => node.name))
      .toEqual(['East Nightless Island', 'Nightless Island', 'West Nightless Island']);
    expect(map.filter((node) => node.kind === 'event')).toHaveLength(13);
    const sea = map.filter((node) => node.kind === 'sea');
    expect(sea).toHaveLength(35);
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
  it('preserves the wind choices of all nine forks after redistributing blank squares', () => {
    const shortcutWinds = new Map([
      ['Canary Isles', ['E', 'S']], ['Tempest Passage', ['E', 'S']],
      ['Pernambuco', ['E', 'S']], ['China Port', ['E', 'S']],
      ['Benin', ['S', 'W']], ['Madagascar', ['N', 'W']],
      ['Goa', ['E']], ['Ocean Crossing', ['N']], ['Ryukyu', ['N']],
    ]);
    const chosenWinds = new Map(map.filter(node => successors(map, node.id).length > 1).map(node => [
      node.name, WIND_DIRECTIONS.filter(wind => windExit(map, node.id, wind) === successors(map, node.id)[1]),
    ]));
    expect(chosenWinds).toEqual(shortcutWinds);
    const goa = map.find(node => node.name === 'Goa')!;
    const [blank, calicut] = walkPath(map, goa.id, 2, 'N').map(id => map[id]);
    expect(blank.kind).toBe('sea');
    expect(calicut.name).toBe('Calicut');
  });
  it('leaves a route out of every stop that can host a roaming encounter', () => {
    const allowsRoamer = (id: number) => map[id].kind !== 'port' && map[id].kind !== 'special';
    for (const node of map.filter(({ id }) => allowsRoamer(id))) {
      for (const wind of WIND_DIRECTIONS) {
        const exits = [-1, 1].flatMap((direction) => walkPath(map, node.id, direction, wind));
        expect(exits.some(allowsRoamer), `${node.name} in ${wind} wind`).toBe(true);
      }
    }
  });
  it('leaves short hops direct and divides longer main-route crossings evenly', () => {
    const fixedStops = map.filter(node => node.kind !== 'sea');
    for (const [index, node] of fixedStops.entries()) {
      const next = fixedStops[(index + 1) % fixedStops.length];
      const distance = Math.hypot(next.x - node.x, next.y - node.y);
      const steps = (next.id - node.id + map.length) % map.length;
      if (distance < 450) expect(steps).toBe(1);
      else expect(steps).toBeGreaterThan(1);
      for (let step = 1; step < steps; step++) {
        const sea = map[(node.id + step) % map.length];
        expect(sea.kind).toBe('sea');
        expect(sea.x).toBeCloseTo(node.x + (next.x - node.x) * step / steps);
        expect(sea.y).toBeCloseTo(node.y + (next.y - node.y) * step / steps);
      }
    }
    for (const node of map) {
      const next = map[successors(map, node.id)[0]];
      const distance = Math.hypot(next.x - node.x, next.y - node.y);
      expect(distance).toBeGreaterThanOrEqual(225);
      expect(distance).toBeLessThan(450);
    }
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
