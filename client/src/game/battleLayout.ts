import { BATTLE_FIELD } from '@happy-voyage/shared';

type Point = { x: number; y: number };

export function battleLayout(width: number, height: number) {
  const portrait = height > width;
  const fieldWidth = portrait ? BATTLE_FIELD.height : BATTLE_FIELD.width;
  const fieldHeight = portrait ? BATTLE_FIELD.width : BATTLE_FIELD.height;
  const zoom = Math.min(Math.max(1, width) / fieldWidth, Math.max(1, height - 190) / fieldHeight);
  const left = (width - fieldWidth * zoom) / 2;
  const top = 86 + (height - 190 - fieldHeight * zoom) / 2;
  return { portrait, zoom, x: left, y: top + (portrait ? fieldHeight * zoom : 0), angle: portrait ? -90 : 0 };
}

export function battleToScreen(layout: ReturnType<typeof battleLayout>, point: Point): Point {
  return layout.portrait
    ? { x: layout.x + point.y * layout.zoom, y: layout.y - point.x * layout.zoom }
    : { x: layout.x + point.x * layout.zoom, y: layout.y + point.y * layout.zoom };
}

export function screenToBattle(layout: ReturnType<typeof battleLayout>, point: Point): Point {
  return layout.portrait
    ? { x: (layout.y - point.y) / layout.zoom, y: (point.x - layout.x) / layout.zoom }
    : { x: (point.x - layout.x) / layout.zoom, y: (point.y - layout.y) / layout.zoom };
}

export const battleTapRadius = (zoom: number) => Math.max(38, 22 / zoom);
export const isBattleDrag = (start: Point, end: Point) => Math.hypot(end.x - start.x, end.y - start.y) > 14;
