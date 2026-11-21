import { WORLD, type MapNode } from '@happy-voyage/shared';

export interface BerthBox { left: number; right: number; top: number; bottom: number }

const angle = 5 * Math.PI / 180;
export const SHIP_BERTH_WIDTH = .95 * (112 * Math.cos(angle) + 124 * Math.sin(angle));
export const SHIP_BERTH_HEIGHT = .95 * (124 * Math.cos(angle) + 112 * Math.sin(angle));

export function shipBounds(x: number, y: number): BerthBox {
  return { left: x - SHIP_BERTH_WIDTH / 2, right: x + SHIP_BERTH_WIDTH / 2, top: y - SHIP_BERTH_HEIGHT / 2, bottom: y + SHIP_BERTH_HEIGHT / 2 };
}

export function berthObstacles(map: MapNode[], labels = new Map<number, BerthBox>()): BerthBox[] {
  return map.flatMap(node => {
    const offset = node.kind === 'island' ? 63 : node.kind === 'port' ? 35 : 55;
    const label = labels.get(node.id);
    return [
      { left: node.x - 80, right: node.x + 80, top: node.y - 76, bottom: node.y + 76 },
      { left: Math.min(node.x - 85, label?.left ?? Infinity), right: Math.max(node.x + 85, label?.right ?? -Infinity), top: Math.min(node.y + offset - 4, label?.top ?? Infinity), bottom: Math.max(node.y + offset + 100, label?.bottom ?? -Infinity) },
    ];
  });
}

export function boxesOverlap(a: BerthBox, b: BerthBox, gap = 8): boolean {
  return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
}

export function shipBerths(map: MapNode[], nodeId: number, count: number, labels?: Map<number, BerthBox>): [number, number][] {
  const node = map.find(node => node.id === nodeId);
  if (!node || count === 0) return [];
  const obstacles = berthObstacles(map, labels);
  const berths: [number, number][] = [];
  for (let radius = 240; berths.length < count; radius += 240) {
    const candidates: [number, number][] = [];
    for (let dy = -radius; dy <= radius; dy += 24) {
      for (let dx = -radius; dx <= radius; dx += 24) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= radius - 240) continue;
        candidates.push([node.x + dx, node.y + dy]);
      }
    }
    candidates.sort((a, b) => {
      const score = ([x, y]: [number, number]) => Math.hypot(x - node.x, y - node.y) + (y > node.y ? 24 : 0);
      return score(a) - score(b) || a[1] - b[1] || a[0] - b[0];
    });
    for (const point of candidates) {
      const box = shipBounds(...point);
      if (box.left < 8 || box.top < 8 || box.right > WORLD.width - 8 || box.bottom > WORLD.height - 8) continue;
      if (obstacles.some(obstacle => boxesOverlap(box, obstacle))) continue;
      berths.push(point);
      obstacles.push(box);
      if (berths.length === count) break;
    }
  }
  return berths;
}
