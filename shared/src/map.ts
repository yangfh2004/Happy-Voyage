import type { MapNode, NodeKind, EventKind } from './types';

/**
 * The default sea route: a closed loop of stops, Monopoly-style. Stop 0 is
 * the home port. To add stops, append rows here; positions are computed.
 */
type Row =
  | [NodeKind & 'port', string]
  | [NodeKind & 'island', string, number, string]
  | [NodeKind & 'event', string, EventKind];

const ROUTE: Row[] = [
  ['port', 'Royal Harbor'],
  ['island', 'Madeira', 120, 'Wine'],
  ['island', 'Canary Isles', 130, 'Sugar'],
  ['event', 'Treasure Shoal', 'treasure'],
  ['island', 'Cape Verde', 140, 'Cotton'],
  ['island', 'Gold Coast', 160, 'Gold Dust'],
  ['island', 'Angola', 170, 'Ivory'],
  ['event', 'Storm Front', 'storm'],
  ['island', 'Brazil', 190, 'Coffee'],
  ['island', 'Caribbean', 200, 'Tobacco'],
  ['island', 'Mexico', 210, 'Cocoa'],
  ['event', 'Trade Winds', 'tradeWind'],
  ['island', 'Peru', 230, 'Silver'],
  ['island', 'Patagonia', 220, 'Furs'],
  ['event', 'Treasure Shoal', 'treasure'],
  ['island', 'Moluccas', 260, 'Spices'],
  ['island', 'Java', 250, 'Coffee'],
  ['island', 'Ceylon', 270, 'Tea'],
  ['event', 'Storm Front', 'storm'],
  ['island', 'Malacca', 280, 'Spices'],
  ['island', 'India', 300, 'Silk'],
  ['event', 'Trade Winds', 'tradeWind'],
  ['island', 'Arabia', 290, 'Incense'],
  ['island', 'Zanzibar', 310, 'Ivory'],
];

/** World size the renderer uses; nodes are laid out on a wobbly ellipse inside it. */
export const WORLD = { width: 1280, height: 720 } as const;

export function createDefaultMap(): MapNode[] {
  const cx = WORLD.width / 2;
  const cy = WORLD.height / 2 + 10;
  return ROUTE.map((row, id) => {
    // Start at the bottom-left and sail clockwise.
    const theta = Math.PI * 0.75 + (id / ROUTE.length) * Math.PI * 2;
    const wobble = 1 + 0.07 * Math.sin(id * 2.3);
    const node: MapNode = {
      id,
      name: row[1],
      kind: row[0],
      x: Math.round(cx + 540 * wobble * Math.cos(theta)),
      y: Math.round(cy + 270 * wobble * Math.sin(theta)),
    };
    if (row[0] === 'island') {
      node.price = row[2];
      node.toll = Math.round(row[2] * 0.4);
      node.specialty = row[3];
    } else if (row[0] === 'event') {
      node.event = row[2];
    }
    return node;
  });
}
