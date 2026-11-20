import type { MapNode, WindDirection } from './types';

export const WIND_DIRECTIONS: WindDirection[] = ['N', 'E', 'S', 'W'];
const vectors = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] } as const;

export function successors(map: MapNode[], id: number): number[] {
  if (!map[id]) throw new Error(`Unknown map node: ${id}`);
  return map[id].next ?? [(id + 1) % map.length];
}

export function windExit(map: MapNode[], id: number, wind: WindDirection): number {
  const exits = successors(map, id);
  if (!exits.length) throw new Error(`No exits at map node: ${id}`);
  const node = map[id];
  const [wx, wy] = vectors[wind];
  let best = exits[0];
  let alignment = 0;
  for (const exit of exits) {
    const target = map[exit];
    if (!target) throw new Error(`Unknown map node: ${exit}`);
    const dot = (target.x - node.x) * wx + (target.y - node.y) * wy;
    if (dot > alignment) { best = exit; alignment = dot; }
  }
  return best;
}

/** Visited nodes, excluding the departure. Reverse currents follow main-course predecessors. */
export function walkPath(map: MapNode[], from: number, steps: number, wind: WindDirection): number[] {
  if (!Number.isInteger(steps)) throw new Error('Steps must be an integer');
  if (!map.length) return [];
  if (!map[from]) throw new Error(`Unknown map node: ${from}`);
  const path: number[] = [];
  let position = from;
  for (let i = 0; i < Math.abs(steps); i++) {
    if (steps < 0) {
      const previous = map.find((node) => successors(map, node.id)[0] === position);
      if (!previous) throw new Error(`No main-course predecessor: ${position}`);
      position = previous.id;
    } else position = windExit(map, position, wind);
    path.push(position);
  }
  return path;
}
