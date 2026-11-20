import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { successors, walkPath, windExit, WIND_DIRECTIONS } from './graph';
import { createDefaultMap } from './map';
import type { GameEvent, MapNode } from './types';

const cross: MapNode[] = [
  { id: 0, name: 'Fork', kind: 'port', x: 0, y: 0, next: [1, 2, 3, 4] },
  { id: 1, name: 'East', kind: 'port', x: 10, y: 0 },
  { id: 2, name: 'South', kind: 'port', x: 0, y: 10 },
  { id: 3, name: 'West', kind: 'port', x: -10, y: 0 },
  { id: 4, name: 'North', kind: 'port', x: 0, y: -10 },
];
const players = [{ name: 'Sailor', color: 0xff0000, isAI: false }];
function seeded() {
  let seed = 7;
  return () => (seed = seed * 16807 % 2147483647) / 2147483647;
}

describe('wind-driven routes', () => {
  it.each([['N', 4], ['E', 1], ['S', 2], ['W', 3]] as const)('chooses %s', (wind, exit) => {
    expect(windExit(cross, 0, wind)).toBe(exit);
  });
  it('falls back to the main course, with stable ties', () => {
    const map = cross.map((node) => ({ ...node }));
    map[0].next = [1, 2];
    expect(windExit(map, 0, 'N')).toBe(1);
    map[2].x = 10;
    expect(windExit(map, 0, 'E')).toBe(1);
  });
  it('walks legacy rings, empty paths and reverse main-course steps', () => {
    const ring = cross.map(({ next: _, ...node }) => node);
    expect(successors(ring, 4)).toEqual([0]);
    expect(walkPath(ring, 4, 3, 'S')).toEqual([0, 1, 2]);
    expect(walkPath(ring, 0, -2, 'N')).toEqual([4, 3]);
    expect(walkPath(ring, 0, 0, 'N')).toEqual([]);
    expect(walkPath([], 0, 2, 'N')).toEqual([]);
    expect(() => walkPath(ring, 99, 1, 'N')).toThrow('Unknown map node');
    expect(() => walkPath(ring, 0, 1.5, 'N')).toThrow('integer');
    expect(() => windExit([{ ...ring[0], next: [] }], 0, 'N')).toThrow('No exits');
  });
  it('uses the current wind for engine movement and pays only actually visited home ports', () => {
    const engine = new GameEngine({ players, map: cross, rng: () => 0 });
    engine.state.wind.direction = 'S';
    engine.currentPlayer.homePort = 1;
    const gold = engine.currentPlayer.gold;
    engine.spinCompass();
    expect(engine.sail()).toEqual([2, 3]);
    engine.resolveLanding();
    expect(engine.currentPlayer.gold).toBeLessThanOrEqual(gold);
    expect(engine.state.log.some((line) => line.includes('royal salary'))).toBe(false);
  });
  it('retains a complete cycling main course and reaches every default node', () => {
    const map = createDefaultMap();
    const visited = new Set<number>();
    const pending = [0];
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      pending.push(...successors(map, id));
    }
    expect(visited.size).toBe(map.length);
    expect(map.filter((n) => successors(map, n.id).length > 1)).toHaveLength(9);
    for (const node of map) expect(successors(map, node.id)[0]).toBe((node.id + 1) % map.length);
    for (const direction of WIND_DIRECTIONS) {
      expect(map.some((node) => successors(map, node.id).length > 1 && windExit(map, node.id, direction) !== windExit(map, node.id, direction === 'S' ? 'E' : 'S'))).toBe(true);
    }
  });
  it('changes to a different direction every 2–4 completed turns, deterministically', () => {
    const make = () => new GameEngine({ players, map: cross.map(({ next: _, ...node }) => node), rng: seeded() });
    const a = make();
    const b = make();
    const events: GameEvent[] = [];
    a.on((event) => events.push(event));
    for (let turn = 0; turn < 20; turn++) {
      const before = { ...a.state.wind };
      for (const game of [a, b]) {
        game.spinCompass(); game.sail(); game.resolveLanding();
      }
      expect(a.state.wind).toEqual(b.state.wind);
      if (before.turnsLeft > 1) expect(a.state.wind).toEqual({ ...before, turnsLeft: before.turnsLeft - 1 });
      else {
        expect(a.state.wind.direction).not.toBe(before.direction);
        expect(a.state.wind.turnsLeft).toBeGreaterThanOrEqual(2);
        expect(a.state.wind.turnsLeft).toBeLessThanOrEqual(4);
      }
    }
    expect(events.some((event) => event.type === 'windChanged')).toBe(true);
    expect(a.state.log.some((line) => line.includes('wind rises'))).toBe(true);
  });
});
