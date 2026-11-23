import { BATTLE_FIELD } from '@happy-voyage/shared';

type Point = { x: number; y: number };
export const CAMERA_45 = Math.SQRT1_2;
export type BattleRect = Point & { width: number; height: number };

export function battleLayout(width: number, height: number) {
  const portrait = height > width;
  const fieldWidth = portrait ? BATTLE_FIELD.height : BATTLE_FIELD.width;
  const fieldHeight = (portrait ? BATTLE_FIELD.width : BATTLE_FIELD.height) * CAMERA_45;
  const hudBottom = height < 450 ? 108 : 140;
  const controlsTop = height - (width < 650 ? 112 : 64);
  const availableHeight = Math.max(1, controlsTop - 8 - hudBottom);
  const zoom = Math.min(Math.max(1, width) / fieldWidth, availableHeight / fieldHeight);
  const left = (width - fieldWidth * zoom) / 2;
  const top = hudBottom + (availableHeight - fieldHeight * zoom) / 2;
  const bounds = { x: left, y: top, width: fieldWidth * zoom, height: fieldHeight * zoom };
  const shipScale = portrait ? Math.max(1, (70 / 1.5) / (125 * CAMERA_45 * zoom)) : 1;
  return { portrait, zoom, shipScale, hudBottom, x: left, y: top + (portrait ? fieldHeight * zoom : 0), angle: 0, bounds, controlsTop };
}

export function battleToScreen(layout: ReturnType<typeof battleLayout>, point: Point & { z?: number }): Point {
  const height = (point.z ?? 0) * CAMERA_45 * layout.zoom;
  return layout.portrait
    ? { x: layout.x + point.y * layout.zoom, y: layout.y - point.x * CAMERA_45 * layout.zoom - height }
    : { x: layout.x + point.x * layout.zoom, y: layout.y + point.y * CAMERA_45 * layout.zoom - height };
}

export function screenToBattle(layout: ReturnType<typeof battleLayout>, point: Point): Point {
  return layout.portrait
    ? { x: (layout.y - point.y) / (CAMERA_45 * layout.zoom), y: (point.x - layout.x) / layout.zoom }
    : { x: (point.x - layout.x) / layout.zoom, y: (point.y - layout.y) / (CAMERA_45 * layout.zoom) };
}

export const battleTapRadius = (zoom: number) => Math.max(38, 22 / zoom);
export const isBattleDrag = (start: Point, end: Point) => Math.hypot(end.x - start.x, end.y - start.y) > 14;

type BattleShipHit = Point & { id: number; depth: number; bounds: BattleRect; radius: number };

export function pickBattleShip<T extends BattleShipHit>(point: Point, ships: T[]): T | undefined {
  const hits = ships.map(ship => ({
    ship,
    distance: Math.hypot(ship.x - point.x, ship.y - point.y),
    onSprite: point.x >= ship.bounds.x - 3 && point.x <= ship.bounds.x + ship.bounds.width + 3
      && point.y >= ship.bounds.y - 3 && point.y <= ship.bounds.y + ship.bounds.height + 3,
  })).filter(hit => hit.onSprite || hit.distance <= Math.max(22, hit.ship.radius));
  hits.sort((a, b) => Number(b.onSprite) - Number(a.onSprite) || b.ship.depth - a.ship.depth || a.distance - b.distance || a.ship.id - b.ship.id);
  return hits[0]?.ship;
}

export function placeBattleLabel(bounds: BattleRect, occupied: BattleRect[], ship: Point, size: { width: number; height: number }, gap: number): BattleRect {
  const minX = bounds.x + 2, minY = bounds.y + 2;
  const maxX = Math.max(minX, bounds.x + bounds.width - size.width - 2);
  const maxY = Math.max(minY, bounds.y + bounds.height - size.height - 2);
  const clampX = (x: number) => Math.max(minX, Math.min(maxX, x));
  const clampY = (y: number) => Math.max(minY, Math.min(maxY, y));
  const xs = new Set([ship.x - size.width / 2, minX, maxX, ...occupied.flatMap((b) => [b.x - size.width - 3, b.x + b.width + 3])].map(clampX));
  const ys = new Set([ship.y + gap, ship.y - gap - size.height, minY, maxY, ...occupied.flatMap((b) => [b.y - size.height - 3, b.y + b.height + 3])].map(clampY));
  const overlap = (a: BattleRect, b: BattleRect) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const hull = { x: ship.x - gap, y: ship.y - gap, width: gap * 2, height: gap * 2 };
  let best = { x: clampX(ship.x - size.width / 2), y: clampY(ship.y + gap), ...size };
  let bestOverlap = Infinity, bestDistance = Infinity;
  for (const x of xs) for (const y of ys) {
    const candidate = { x, y, ...size };
    const area = occupied.reduce((sum, b) => sum + overlap(candidate, b) * 2, overlap(candidate, hull));
    const distance = Math.hypot(x + size.width / 2 - ship.x, y + size.height / 2 - ship.y) + (y < ship.y ? 2 : 0);
    if (area < bestOverlap || (area === bestOverlap && distance < bestDistance)) {
      best = candidate; bestOverlap = area; bestDistance = distance;
    }
  }
  return best;
}
