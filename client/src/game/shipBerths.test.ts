import { describe, expect, it } from 'vitest';
import { createDefaultMap, WORLD, type MapNode } from '@happy-voyage/shared';
import { berthObstacles, boxesOverlap, MAX_BERTH_OFFSET, MIN_BERTH_SCALE, occupiedShipPlacements, shipBerths, shipBounds, type BerthBox } from './shipBerths';

function check(map: MapNode[], players: { id: number; position: number }[], labels?: Map<number, BerthBox>) {
  const placements = occupiedShipPlacements(map, players, labels);
  const names = berthObstacles(map, labels).filter((_, i) => i % 2 === 1);
  expect(placements.size).toBe(players.length);
  const boxes: BerthBox[] = [];
  for (const player of players) {
    const { x, y, scale } = placements.get(player.id)!;
    const node = map.find(n => n.id === player.position)!;
    const distance = Math.hypot(x - node.x, y - node.y);
    expect(distance).toBeLessThanOrEqual(MAX_BERTH_OFFSET);
    for (const other of map) if (other.id !== node.id) expect(distance, `${node.name} vs ${other.name}`).toBeLessThan(Math.hypot(x - other.x, y - other.y));
    expect(scale).toBeGreaterThanOrEqual(MIN_BERTH_SCALE);
    expect(scale).toBeLessThanOrEqual(1);
    const box = shipBounds(x, y, scale);
    expect(box.left).toBeGreaterThanOrEqual(8);
    expect(box.top).toBeGreaterThanOrEqual(8);
    expect(box.right).toBeLessThanOrEqual(WORLD.width - 8);
    expect(box.bottom).toBeLessThanOrEqual(WORLD.height - 8);
    for (const name of names) expect(boxesOverlap(box, name), `${node.name} label`).toBe(false);
    for (const other of boxes) expect(boxesOverlap(box, other), `${node.name} ship`).toBe(false);
    boxes.push(box);
  }
  return placements;
}

describe('attached ship berths', () => {
  const map = createDefaultMap();

  it.each(Array.from({ length: 16 }, (_, i) => [1 + Math.floor(i / 4), 1 + i % 4]))('keeps neighbouring fleets attached and clear with %s and %s ships', (firstCount, secondCount) => {
    for (const [i, first] of map.entries()) for (const second of map.slice(i + 1)) {
      if (Math.hypot(first.x - second.x, first.y - second.y) > 700) continue;
      check(map, Array.from({ length: firstCount + secondCount }, (_, id) => ({ id, position: id < firstCount ? first.id : second.id })));
    }
  }, 60000);

  it.each([1, 2, 3, 4])('keeps %s ships attached at every node without covering labels or other ships', count => {
    for (const node of map) check(map, Array.from({ length: count }, (_, id) => ({ id, position: node.id })));
  });

  it('is independent of input order, including Portugal and Revival', () => {
    const port = map.find(n => n.nation === 'Portugal' && n.kind === 'port')!;
    const revival = map.find(n => n.special === 'revival')!;
    const players = Array.from({ length: 8 }, (_, id) => ({ id, position: id < 4 ? port.id : revival.id }));
    const positions = check(map, players);
    expect(occupiedShipPlacements([...map].reverse(), [...players].reverse())).toEqual(positions);
  });

  it('uses measured label bounds and shrinks only crowded stops', () => {
    const players = Array.from({ length: 4 }, (_, id) => ({ id, position: 11 }));
    const positions = check(map, players);
    expect([...positions.values()].some(p => p.scale < 1)).toBe(true);
    const single = check(map, [{ id: 0, position: 0 }]);
    expect(single.get(0)!.scale).toBe(1);
    const node = map[0];
    check(map, [{ id: 0, position: 0 }], new Map([[0, { left: node.x - 230, right: node.x + 230, top: node.y - 250, bottom: node.y - 80 }]]));
  });

  it('prefers clear water when a full-size clear berth exists', () => {
    const node = { ...map[0], x: 600, y: 500 };
    const positions = check([node], [{ id: 0, position: 0 }]);
    const p = positions.get(0)!;
    expect(p.scale).toBe(1);
    expect(boxesOverlap(shipBounds(p.x, p.y), berthObstacles([node])[0], 0)).toBe(false);
  });

  it('never throws for impossible labels or excessive occupancy', () => {
    const node = map[0], labels = new Map([[node.id, { left: 0, right: WORLD.width, top: 0, bottom: WORLD.height }]]);
    const players = Array.from({ length: 12 }, (_, id) => ({ id, position: node.id }));
    const positions = occupiedShipPlacements(map, players, labels);
    expect(positions.size).toBe(players.length);
    for (const berth of positions.values()) expect(berth.scale).toBe(MIN_BERTH_SCALE);
    expect(() => occupiedShipPlacements(map, Array.from({ length: 20 }, (_, id) => ({ id, position: 11 })))).not.toThrow();
  });

  it('handles empty charts, missing stops and empty fleets', () => {
    expect(shipBerths([], 0, 4)).toEqual([]);
    expect(shipBerths(map, -1, 4)).toEqual([]);
    expect(shipBerths(map, 0, 0)).toEqual([]);
  });
});
