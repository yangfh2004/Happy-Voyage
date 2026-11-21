import { describe, expect, it } from 'vitest';
import { createDefaultMap, WORLD } from '@happy-voyage/shared';
import { berthObstacles, boxesOverlap, occupiedShipBerths, shipBerths, shipBounds } from './shipBerths';

describe('nearby-water ship berths', () => {
  it.each(Array.from({ length: 16 }, (_, i) => [1 + Math.floor(i / 4), 1 + i % 4]))('reserves ships across all neighbouring stop pairs with %s and %s occupants', (firstCount, secondCount) => {
    const map = createDefaultMap();
    const obstacles = berthObstacles(map);
    for (const [index, first] of map.entries()) for (const second of map.slice(index + 1)) {
      if (Math.hypot(first.x - second.x, first.y - second.y) > 700) continue;
      const players = Array.from({ length: firstCount + secondCount }, (_, id) => ({ id, position: id < firstCount ? first.id : second.id }));
      const berths = occupiedShipBerths(map, players);
      expect(berths.size).toBe(players.length);
      const bounds = [...berths.values()].map(([x, y]) => shipBounds(x, y));
      for (const [i, box] of bounds.entries()) {
        for (const other of bounds.slice(i + 1)) expect(boxesOverlap(box, other), `${first.name} + ${second.name}`).toBe(false);
        for (const obstacle of obstacles) expect(boxesOverlap(box, obstacle)).toBe(false);
      }
    }
  }, 20000);

  it('keeps Portugal Port and Revival Island fleets separate and independent of input order', () => {
    const map = createDefaultMap();
    const port = map.find(node => node.kind === 'port' && node.nation === 'Portugal')!;
    const revival = map.find(node => node.special === 'revival')!;
    const players = Array.from({ length: 8 }, (_, id) => ({ id, position: id < 4 ? port.id : revival.id }));
    const positions = occupiedShipBerths(map, players);
    const boxes = [...positions.values()].map(([x, y]) => shipBounds(x, y));
    for (const [i, box] of boxes.entries()) for (const other of boxes.slice(i + 1)) expect(boxesOverlap(box, other)).toBe(false);
    expect(occupiedShipBerths([...map].reverse(), [...players].reverse())).toEqual(positions);
    expect(occupiedShipBerths(map, [])).toEqual(new Map());
  });

  it.each([1, 2, 3, 4])('keeps %s full-size, maximally bobbed portraits and hulls clear of every island and label at every stop', count => {
    const map = createDefaultMap();
    for (const node of map) {
      const positions = shipBerths(map, node.id, count);
      expect(positions).toHaveLength(count);
      const bounds = positions.map(([x, y]) => shipBounds(x, y));
      for (const [index, box] of bounds.entries()) {
        expect(box.left).toBeGreaterThanOrEqual(8);
        expect(box.top).toBeGreaterThanOrEqual(8);
        expect(box.right).toBeLessThanOrEqual(WORLD.width - 8);
        expect(box.bottom).toBeLessThanOrEqual(WORLD.height - 8);
        for (const other of bounds.slice(index + 1)) expect(boxesOverlap(box, other)).toBe(false);
        for (const stop of map) {
          const labelY = stop.y + (stop.kind === 'island' ? 63 : stop.kind === 'port' ? 35 : 55);
          const art = { left: stop.x - 80, right: stop.x + 80, top: stop.y - 76, bottom: stop.y + 76 };
          const label = { left: stop.x - 85, right: stop.x + 85, top: labelY - 4, bottom: labelY + 100 };
          expect(boxesOverlap(box, art), `ship ${index} at ${node.name} vs ${stop.name} art`).toBe(false);
          expect(boxesOverlap(box, label), `ship ${index} at ${node.name} vs ${stop.name} label`).toBe(false);
        }
      }
      expect(shipBerths(map, node.id, count)).toEqual(positions);
    }
  });

  it('honours measured labels that extend outside the conservative label envelope', () => {
    const map = createDefaultMap();
    const node = map[0];
    const label = { left: node.x - 230, right: node.x + 230, top: node.y - 250, bottom: node.y - 80 };
    for (const [x, y] of shipBerths(map, node.id, 4, new Map([[node.id, label]]))) {
      expect(boxesOverlap(shipBounds(x, y), label)).toBe(false);
    }
  });

  it('handles an empty chart, missing node, and empty fleet', () => {
    expect(shipBerths([], 0, 4)).toEqual([]);
    expect(shipBerths(createDefaultMap(), -1, 4)).toEqual([]);
    expect(shipBerths(createDefaultMap(), 0, 0)).toEqual([]);
  });
});
