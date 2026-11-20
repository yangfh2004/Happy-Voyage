import { NATIONS } from './nations';
import type { MapNode, SpecialKind, EventKind, Specialty } from './types';

export const WORLD = { width: 1500, height: 1200 } as const;
const lands = ['Madeira', 'Canary Isles', 'Cape Verde', 'Azores', 'Hispaniola', 'Cuba', 'Yucatan', 'Veracruz', 'Cartagena', 'Guiana', 'Pernambuco', 'Bahia', 'Rio de Janeiro', 'Patagonia', 'Tierra del Fuego', 'Valparaiso', 'Callao', 'Panama', 'Gold Coast', 'Benin', 'Luanda', 'Cape of Good Hope', 'Mozambique', 'Zanzibar', 'Sofala', 'Madagascar', 'Socotra', 'Muscat', 'Goa', 'Calicut', 'Ceylon', 'Malacca', 'Sumatra', 'Java', 'Borneo', 'Moluccas', 'Luzon', 'Formosa', 'Ryukyu', 'Hokkaido'];
const goods: Specialty[] = ['Wine', 'Sugar', 'Cotton', 'Timber', 'Cocoa', 'Tobacco', 'Silver', 'Spices', 'Silk', 'Tea'];
const specials: [SpecialKind, string, string][] = [
  ['skeleton', 'Skeleton Island', '骷髅岛'], ['treasure', 'Treasure Island', '金银岛'],
  ['mist', 'Mist Island', '迷雾岛'], ['revival', 'Revival Island', '复活岛'],
  ['nightless', 'Nightless Island', '不夜岛'], ['wind', 'Wind Island', '风之岛'],
  ['dragonSnake', 'Dragon Snake Island', '龙蛇岛'],
];
const events: EventKind[] = ['treasure', 'storm', 'tradeWind', 'pirates', 'smallMonster', 'whirlpool', 'bottle', 'floatingCargo', 'merchant', 'wyvern', 'largeMonster', 'turtle', 'treasure'];
const eventNames = ['Treasure Shoal', 'Tempest Passage', 'Zephyr Strait', 'Pirate Cove', 'Serpent Shallows', 'Bermuda Triangle', 'Drifting Bottle Reef', 'Castaway Cargo Bay', 'Merchant Lane', 'Wyvern Cliffs', 'Kraken Deep', 'Turtle Reach', 'Sunken Crown Shoal'];

export function createDefaultMap(): MapNode[] {
  const nodes: MapNode[] = [];
  let event = 0;
  for (const [sector, { name: nation }] of NATIONS.entries()) {
    nodes.push({ id: 0, name: `${nation} Port`, nation, kind: 'port', x: 0, y: 0 });
    for (let j = 0; j < 4; j++) {
      const i = sector * 4 + j;
      const price = Math.round((100 + i * 250 / 39) / 5) * 5;
      nodes.push({ id: 0, name: lands[i], kind: 'island', price, toll: Math.round(price * 0.35), specialty: goods[i % goods.length], ironYield: 1 + i % 3, x: 0, y: 0 });
      if (j === 1 && sector < 7) {
        const [special, name, chineseName] = specials[sector];
        nodes.push({ id: 0, name, chineseName, special, kind: 'special', x: 0, y: 0 });
      }
      if (j === 2 || (j === 3 && sector >= 7)) {
        const kind = events[event];
        nodes.push({ id: 0, name: eventNames[event++], event: kind, kind: 'event', x: 0, y: 0 });
      }
    }
  }
  const map: MapNode[] = nodes.map((node, id) => {
    if (id >= 64) return { ...node, id, x: 80, y: 1070 - (id - 64) * 196 };
    // Outbound lanes wind east and west; the western margin carries the return leg.
    const lane = Math.floor(id / 8);
    const column = id % 8;
    const x = 260 + (lane % 2 === 0 ? column : 7 - column) * 160;
    const y = 90 + lane * 140 + Math.sin(column * Math.PI / 3.5) * 12;
    return { ...node, id, x, y };
  });
  for (const id of [2, 12, 18, 28, 34, 44, 50, 60]) {
    const lane = Math.floor(id / 8);
    const target = lane < 7 ? (lane + 1) * 8 + 7 - id % 8 : 64;
    map[id].next = [(id + 1) % map.length, target];
  }
  // A return-leg fork offers a northbound shortcut while retaining the homeward course.
  map[66].next = [67, 68];
  return map;
}
