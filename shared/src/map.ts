import { NATIONS } from './nations';
import type { MapNode, SpecialKind, EventKind, Specialty } from './types';

const chartScale = 2;
export const WORLD = { width: 3400 * chartScale, height: 2600 * chartScale } as const;
export const MIN_NODE_SPACING = 175;

/** Fixed archipelagos, grouped by nation in route order. */
const archipelagos: [number, number][][] = [
  [[1484, 355], [1596, 572], [1821, 564], [1719, 395], [1619, 191], [1835, 202], [1966, 359]],
  [[2275, 565], [2329, 385], [2546, 309], [2698, 465], [2494, 514], [2434, 745], [2640, 695]],
  [[2734, 883], [2900, 746], [3106, 839], [3169, 1043], [2958, 981], [2764, 1118], [2988, 1217]],
  [[2999, 1399], [2803, 1455], [2961, 1620], [3166, 1543], [3139, 1754], [2920, 1835], [2766, 1679]],
  [[2518, 1824], [2295, 1866], [2452, 2033], [2643, 1970], [2618, 2226], [2410, 2286], [2000, 1965]],
  [[1909, 2177], [1873, 2373], [1634, 2445], [1689, 2207], [1705, 2012], [1498, 2072], [1488, 2276]],
  [[1123, 2230], [1117, 1979], [995, 1845], [928, 2069], [881, 2286], [709, 2141], [776, 1943]],
  [[570, 1778], [377, 1774], [229, 1558], [476, 1600], [693, 1589], [593, 1397], [390, 1387]],
  [[411, 1204], [252, 1066], [271, 850], [466, 990], [905, 1148], [664, 941], [528, 765]],
  [[668, 523], [789, 716], [1013, 754], [1126, 554], [928, 535], [840, 327], [1045, 341]],
];
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
const seaStopsBetweenSectors = [3, 2, 2, 2, 2, 3, 2, 2, 2, 3];
const longStretches = new Set([25, 31, 33, 36, 42, 51, 59]);
const seaLaneBias = new Map([[55, .2]]);

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
        const roaming = !['treasure', 'storm', 'tradeWind'].includes(kind);
        const seaNames = ['Uncharted Waters', 'Silent Shoals', 'Azure Passage', 'Distant Horizon', 'Open Ocean', 'Wandering Tides', 'Ocean Crossing', 'Silver Current', 'Farwater Reach'];
        nodes.push({ id: 0, name: roaming ? seaNames[event - 3] : eventNames[event], event: roaming ? 'openSea' : kind, kind: 'event', x: 0, y: 0 });
        event++;
      }
    }
  }
  const coordinates = archipelagos.flat();
  const map: MapNode[] = [];
  const stopIds: number[] = [];
  let sea = 0;
  nodes.forEach((node, index) => {
    const [x, y] = coordinates[index];
    stopIds.push(map.length);
    map.push({ ...node, id: map.length, x: x * chartScale, y: y * chartScale });
    const count = index % 7 === 6 ? seaStopsBetweenSectors[Math.floor(index / 7)] : Number(longStretches.has(index));
    const [nextX, nextY] = coordinates[(index + 1) % coordinates.length];
    for (let j = 1; j <= count; j++) {
      const fraction = (j + (seaLaneBias.get(index) ?? 0)) / (count + 1);
      sea++;
      map.push({
        id: map.length, kind: 'sea', name: `Open water ${sea}`, chineseName: `海上 ${sea}`,
        x: (x + (nextX - x) * fraction) * chartScale,
        y: (y + (nextY - y) * fraction) * chartScale,
      });
    }
  });
  for (const [from, to] of [[2, 7], [12, 19], [18, 20], [28, 31], [34, 38], [44, 53], [50, 53], [60, 64], [66, 69]]) {
    const id = stopIds[from];
    map[id].next = [(id + 1) % map.length, stopIds[to]];
  }
  return map;
}
