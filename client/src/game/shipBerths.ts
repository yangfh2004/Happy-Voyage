import { nodeName, WORLD, type MapNode } from '@happy-voyage/shared';
import { islandLandscape } from './islandArt';
import { harbourLandscape } from './harbourArt';

export interface BerthBox { left: number; right: number; top: number; bottom: number }
export interface ShipBerth { x: number; y: number; scale: number }
export interface MooredBerth extends ShipBerth { nodeId: number }
const angle = 5 * Math.PI / 180;
export const SHIP_BERTH_WIDTH = .95 * (112 * Math.cos(angle) + 124 * Math.sin(angle));
export const SHIP_BERTH_HEIGHT = .95 * (124 * Math.cos(angle) + 112 * Math.sin(angle));
export const MAX_BERTH_OFFSET = 270;
export const MIN_BERTH_SCALE = .65;
export const SINGLE_SHORE_DISTANCE = 100;
export const SHARED_SHORE_DISTANCE = 110;
const SCALES = [1, .95, .9, .85, .8, .75, .7, MIN_BERTH_SCALE];

export function shipBounds(x: number, y: number, scale = 1): BerthBox {
  return { left: x - SHIP_BERTH_WIDTH * scale / 2, right: x + SHIP_BERTH_WIDTH * scale / 2, top: y - SHIP_BERTH_HEIGHT * scale / 2, bottom: y + SHIP_BERTH_HEIGHT * scale / 2 };
}

export function berthObstacles(map: MapNode[], labels = new Map<number, BerthBox>()): BerthBox[] {
  return map.flatMap(node => {
    const offset = node.kind === 'island' || node.kind === 'port' ? 63 : 55;
    const lines = [0];
    for (const word of node.name.split(' ')) {
      const width = word.length * 9.75;
      const index = lines.length - 1;
      if (lines[index] && lines[index] + 5 + width > 146) lines.push(width);
      else lines[index] += (lines[index] ? 5 : 0) + width;
    }
    const chineseWidth = nodeName(node, 'zh').length * 19;
    const width = Math.max(...lines, Math.min(146, chineseWidth), node.kind === 'island' ? 96 : 0) + 6;
    const height = (Math.max(lines.length, Math.ceil(chineseWidth / 146)) + (node.kind === 'island' ? 1 : 0)) * 24;
    return [
      { left: node.x - 80, right: node.x + 80, top: node.y - 76, bottom: node.y + 76 },
      labels.get(node.id) ?? { left: node.x - width / 2, right: node.x + width / 2, top: node.y + offset, bottom: node.y + offset + height },
    ];
  });
}

export function boxesOverlap(a: BerthBox, b: BerthBox, gap = 2): boolean {
  return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
}

function overlapArea(a: BerthBox, b: BerthBox): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

interface Candidate extends ShipBerth { box: BerthBox; score: number }
const cache = new WeakMap<MapNode[], { key: string; candidates: Map<string, Candidate[]>; layouts: Map<string, Candidate[][]> }>();

export function occupiedShipPlacements(map: MapNode[], players: { id: number; position: number }[], labels?: Map<number, BerthBox>, previous: ReadonlyMap<number, MooredBerth> = new Map()): Map<number, ShipBerth> {
  const key = JSON.stringify(labels ? [...labels].sort(([a], [b]) => a - b) : []);
  let stored = cache.get(map);
  if (!stored || stored.key !== key) {
    stored = { key, candidates: new Map(), layouts: new Map() };
    cache.set(map, stored);
  }
  const ordered = [...map].sort((a, b) => a.id - b.id);
  const obstacles = berthObstacles(ordered, labels), art = obstacles.filter((_, i) => i % 2 === 0), names = obstacles.filter((_, i) => i % 2 === 1);
  const candidatesFor = (node: MapNode, scale: number, allowLabels = false, fine = false): Candidate[] => {
    const id = `${node.id}:${scale}:${allowLabels}:${fine}`;
    if (stored.candidates.has(id)) return stored.candidates.get(id)!;
    const candidates: Candidate[] = [];
    const neighbours = map.filter(other => other.id !== node.id);
    const ownIndex = ordered.findIndex(other => other.id === node.id);
    const coast = node.kind === 'island' ? islandLandscape(node).coast : node.kind === 'port' ? harbourLandscape(node).coast : null;
    const step = fine ? 3 : 6;
    for (let dy = -MAX_BERTH_OFFSET; dy <= MAX_BERTH_OFFSET; dy += step) for (let dx = -MAX_BERTH_OFFSET; dx <= MAX_BERTH_OFFSET; dx += step) {
      const distance = Math.hypot(dx, dy), x = node.x + dx, y = node.y + dy;
      if (distance > MAX_BERTH_OFFSET) continue;
      if (fine && distance > SHARED_SHORE_DISTANCE && (dx % 6 !== 0 || dy % 6 !== 0)) continue;
      let clearance = 400;
      for (const other of neighbours) clearance = Math.min(clearance, Math.hypot(x - other.x, y - other.y));
      if (clearance <= distance) continue;
      const box = shipBounds(x, y, scale);
      if (box.left < 8 || box.top < 8 || box.right > WORLD.width - 8 || box.bottom > WORLD.height - 8) continue;
      const collisions = names.filter(label => boxesOverlap(box, label));
      if (!allowLabels && collisions.length) continue;
      const area = art.reduce((sum, island, index) => sum + (index === ownIndex ? 0 : overlapArea(box, island)), 0);
      const penalty = collisions.reduce((sum, label) => sum + 1e9 + overlapArea(box, label), 0);
      const hullY = dy + 39 * .95 * scale;
      const hullDistance = Math.hypot(dx, hullY);
      const ux = hullDistance ? dx / hullDistance : 0, uy = hullDistance ? hullY / hullDistance : -1;
      const radius = coast ? Math.max(...coast.map(point => (point.x - 80) * ux + (point.y - 76) * uy))
        : Math.hypot(45 * ux, 30 * uy);
      const shore = radius + Math.hypot(ux * 38, uy * 10) * .95 * scale - 4;
      const shoreGap = Math.abs(hullDistance - shore);
      const remote = Math.max(0, distance - SINGLE_SHORE_DISTANCE);
      candidates.push({ x, y, scale, box, score: penalty + remote * remote * 10000 + shoreGap * shoreGap * 20 + area * 2 + distance - clearance * .1 });
    }
    candidates.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
    stored.candidates.set(id, candidates);
    return candidates;
  };
  const fixed = new Map<number, ShipBerth>();
  const reserved: BerthBox[] = [];
  for (const player of [...players].sort((a, b) => a.id - b.id)) {
    const berth = previous.get(player.id), node = map.find(n => n.id === player.position);
    if (!berth || !node || berth.nodeId !== node.id) continue;
    const { x, y, scale } = berth;
    if (![x, y, scale].every(Number.isFinite) || scale < MIN_BERTH_SCALE || scale > 1) continue;
    const distance = Math.hypot(x - node.x, y - node.y), box = shipBounds(x, y, scale);
    if (distance > SHARED_SHORE_DISTANCE || map.some(other => other.id !== node.id && Math.hypot(x - other.x, y - other.y) <= distance)) continue;
    if (box.left < 8 || box.top < 8 || box.right > WORLD.width - 8 || box.bottom > WORLD.height - 8) continue;
    if ([...names, ...reserved].some(other => boxesOverlap(box, other))) continue;
    fixed.set(player.id, { x, y, scale }); reserved.push(box);
  }
  const fixedBoxes = [...reserved];
  let shoreLimit = SHARED_SHORE_DISTANCE;
  const layoutsFor = (node: MapNode, count: number, scale: number): Candidate[][] => {
    const solo = players.filter(player => player.position === node.id).length === 1;
    const limit = solo ? Math.min(SINGLE_SHORE_DISTANCE, shoreLimit) : shoreLimit;
    const id = `${node.id}:${count}:${scale}:${limit}`;
    if (!fixed.size && stored.layouts.has(id)) return stored.layouts.get(id)!;
    const candidates = candidatesFor(node, scale, false, scale === MIN_BERTH_SCALE).filter(c => Math.hypot(c.x - node.x, c.y - node.y) <= limit && fixedBoxes.every(box => !boxesOverlap(c.box, box))), layouts: Candidate[][] = [];
    for (let seed = 0; seed < candidates.length; seed++) {
      const chosen = [candidates[seed]];
      for (const candidate of candidates) {
        if (chosen.length === count) break;
        if (chosen.every(other => !boxesOverlap(candidate.box, other.box))) chosen.push(candidate);
      }
      if (chosen.length === count) layouts.push(chosen);
    }
    if (!layouts.length) {
      let attempts = 0;
      const complete = (chosen: Candidate[], available: Candidate[]): boolean => {
        if (chosen.length === count) { layouts.push(chosen); return true; }
        if (++attempts > 100000 || chosen.length + available.length < count) return false;
        for (const [index, candidate] of available.entries()) {
          if (complete([...chosen, candidate], available.slice(index + 1).filter(other => !boxesOverlap(candidate.box, other.box)))) return true;
        }
        return false;
      };
      complete([], candidates);
    }
    layouts.sort((a, b) => a.reduce((sum, c) => sum + c.score, 0) - b.reduce((sum, c) => sum + c.score, 0));
    if (!fixed.size) stored.layouts.set(id, layouts);
    return layouts;
  };
  const groups = [...map].sort((a, b) => a.id - b.id).flatMap(node => {
    const occupants = players.filter(p => p.position === node.id && !fixed.has(p.id)).sort((a, b) => a.id - b.id);
    return occupants.length ? [{ node, occupants, level: 0, chosen: [] as Candidate[] }] : [];
  });
  let visits = 0;
  const search = (): boolean => {
    if (++visits > 10000) return false;
    const remaining = groups.filter(g => !g.chosen.length).map(group => ({
      group, available: layoutsFor(group.node, group.occupants.length, SCALES[group.level]).filter(layout => layout.every(c => reserved.every(box => !boxesOverlap(c.box, box)))),
    })).sort((a, b) => a.available.length - b.available.length || a.group.node.id - b.group.node.id);
    if (!remaining.length) return true;
    const { group, available } = remaining[0];
    for (const layout of available) {
      group.chosen = layout;
      reserved.push(...layout.map(c => c.box));
      if (search()) return true;
      reserved.splice(reserved.length - layout.length);
      group.chosen = [];
    }
    return false;
  };
  while (!search()) {
    const next = groups.filter(g => g.level < SCALES.length - 1).sort((a, b) => layoutsFor(a.node, a.occupants.length, SCALES[a.level]).length - layoutsFor(b.node, b.occupants.length, SCALES[b.level]).length || a.node.id - b.node.id)[0];
    if (!next) {
      if (fixed.size) return occupiedShipPlacements(map, players, labels);
      if (shoreLimit < MAX_BERTH_OFFSET) {
        shoreLimit = MAX_BERTH_OFFSET;
        visits = 0;
        continue;
      }
      break;
    }
    next.level++; visits = 0;
  }
  const positions = new Map<number, ShipBerth>(fixed);
  for (const group of groups) {
    if (!group.chosen.length) {
      for (let i = 0; i < group.occupants.length; i++) {
        const penalty = (c: Candidate) => c.score + reserved.reduce((sum, box) => sum + (boxesOverlap(c.box, box) ? 1e9 + overlapArea(c.box, box) : 0), 0);
        const hard = candidatesFor(group.node, MIN_BERTH_SCALE);
        const best = [...(hard.length ? hard : candidatesFor(group.node, MIN_BERTH_SCALE, true))].sort((a, b) => penalty(a) - penalty(b))[0]
          ?? { x: group.node.x, y: group.node.y, scale: MIN_BERTH_SCALE, box: shipBounds(group.node.x, group.node.y, MIN_BERTH_SCALE), score: 0 };
        group.chosen.push(best); reserved.push(best.box);
      }
    }
    group.occupants.forEach((player, i) => { const { x, y, scale } = group.chosen[i]; positions.set(player.id, { x, y, scale }); });
  }
  return positions;
}

export function occupiedShipBerths(map: MapNode[], players: { id: number; position: number }[], labels?: Map<number, BerthBox>): Map<number, [number, number]> {
  return new Map([...occupiedShipPlacements(map, players, labels)].map(([id, { x, y }]) => [id, [x, y]]));
}

export function shipBerths(map: MapNode[], nodeId: number, count: number, labels?: Map<number, BerthBox>): [number, number][] {
  return [...occupiedShipBerths(map, Array.from({ length: count }, (_, id) => ({ id, position: nodeId })), labels).values()];
}
