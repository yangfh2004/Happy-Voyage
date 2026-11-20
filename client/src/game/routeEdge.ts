import { WORLD, type MapNode } from '@happy-voyage/shared';

export function routeEdge(map: MapNode[], from: number, to: number, shortcut: boolean) {
  const a = map[from];
  const b = map[to];
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const dx = length ? (b.x - a.x) / length : 0;
  const dy = length ? (b.y - a.y) / length : 0;
  const inset = Math.min(38, length / 4);
  const overlaps = shortcut && length > 0 && map.some((node) => {
    if (node.id === from || node.id === to) return false;
    const along = (node.x - a.x) * dx + (node.y - a.y) * dy;
    const across = Math.abs((node.x - a.x) * dy - (node.y - a.y) * dx);
    return along > 0 && along < length && across < 32;
  });
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const side = -dy * (midX - WORLD.width / 2) + dx * (midY - WORLD.height / 2) >= 0 ? 1 : -1;
  const offset = overlaps ? 120 * side : 0;
  const point = (t: number) => ({
    x: a.x + inset * dx + t * (length - 2 * inset) * dx - 2 * (1 - t) * t * dy * offset,
    y: a.y + inset * dy + t * (length - 2 * inset) * dy + 2 * (1 - t) * t * dx * offset,
  });
  return { point, length, inset, curved: overlaps };
}
