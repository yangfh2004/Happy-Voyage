import { GAMEPLAY_TUNING } from './gameplayTuning';
import { NATIONS } from './nations';
import type { MapNode, SpecialKind, EventKind, Specialty } from './types';

const chartScale = 2;
export const WORLD = { width: 3400 * chartScale, height: 2600 * chartScale } as const;
export const MIN_NODE_SPACING = 175;

/** Fixed archipelagos, grouped by nation in route order. */
const archipelagos: [number, number][][] = [
  [[1484, 355], [1596, 572], [1821, 564], [1719, 395], [1619, 191], [1835, 202], [1966, 359], [2120.5, 462]],
  [[2275, 565], [2329, 385], [2546, 309], [2698, 465], [2494, 514], [2434, 745], [2640, 695]],
  [[2734, 883], [2900, 746], [3106, 839], [3169, 1043], [2958, 981], [2764, 1118], [2988, 1217]],
  [[2999, 1399], [2803, 1455], [2961, 1620], [3166, 1543], [3139, 1754], [2920, 1835], [2766, 1679]],
  [[2518, 1824], [2295, 1866], [2452, 2033], [2643, 1970], [2618, 2226], [2410, 2286], [2000, 1965]],
  [[1909, 2177], [1873, 2373], [1634, 2445], [1689, 2207], [1705, 2012], [1498, 2072], [1488, 2276]],
  [[1123, 2230], [1117, 1979], [995, 1845], [928, 2069], [881, 2286], [709, 2141], [776, 1943]],
  [[570, 1778], [377, 1774], [229, 1558], [476, 1600], [693, 1589], [593, 1397], [390, 1387]],
  [[411, 1204], [252, 1066], [271, 850], [368.5, 920], [466, 990], [905, 1148], [664, 941], [528, 765]],
  [[668, 523], [789, 716], [1013, 754], [1126, 554], [928, 535], [840, 327], [1045, 341]],
];
const lands = ['Madeira', 'Canary Isles', 'Cape Verde', 'Azores', 'Hispaniola', 'Cuba', 'Yucatan', 'Veracruz', 'Cartagena', 'Guiana', 'Pernambuco', 'Bahia', 'Rio de Janeiro', 'Patagonia', 'Tierra del Fuego', 'Valparaiso', 'Callao', 'Panama', 'Gold Coast', 'Benin', 'Luanda', 'Cape of Good Hope', 'Mozambique', 'Zanzibar', 'Sofala', 'Madagascar', 'Socotra', 'Muscat', 'Goa', 'Calicut', 'Ceylon', 'Malacca', 'Sumatra', 'Java', 'Borneo', 'Moluccas', 'Luzon', 'Formosa', 'Ryukyu', 'Hokkaido'];
const goods: Specialty[] = ['Wine', 'Sugar', 'Cotton', 'Timber', 'Cocoa', 'Tobacco', 'Silver', 'Spices', 'Silk', 'Tea'];
const specials: [sector: number, afterColony: number, special: SpecialKind, name: string, chineseName: string][] = [
  [0, 1, 'skeleton', 'Skeleton Island', '骷髅岛'],
  [0, 3, 'nightless', 'East Nightless Island', '东不夜岛'],
  [1, 1, 'treasure', 'Treasure Island', '金银岛'],
  [2, 1, 'mist', 'Mist Island', '迷雾岛'],
  [3, 1, 'revival', 'Revival Island', '复活岛'],
  [4, 1, 'nightless', 'Nightless Island', '不夜岛'],
  [5, 1, 'wind', 'Wind Island', '风之岛'],
  [6, 1, 'dragonSnake', 'Dragon Snake Island', '龙蛇岛'],
  [8, 1, 'nightless', 'West Nightless Island', '西不夜岛'],
];
const events: EventKind[] = ['treasure', 'storm', 'tradeWind', 'pirates', 'smallMonster', 'whirlpool', 'bottle', 'floatingCargo', 'merchant', 'wyvern', 'largeMonster', 'turtle', 'treasure'];
const eventNames = ['Amber Shoal', 'Tempest Passage', 'Zephyr Strait', 'Pirate Cove', 'Serpent Shallows', 'Bermuda Triangle', 'Drifting Bottle Reef', 'Castaway Cargo Bay', 'Merchant Lane', 'Wyvern Cliffs', 'Kraken Deep', 'Turtle Reach', 'Crown Shoal'];

export function createDefaultMap(): MapNode[] {
  const rules = GAMEPLAY_TUNING.map;
  const nodes: MapNode[] = [];
  let event = 0;
  for (const [sector, { name: nation }] of NATIONS.entries()) {
    nodes.push({ id: 0, name: `${nation} Port`, nation, kind: 'port', x: 0, y: 0 });
    for (let j = 0; j < 4; j++) {
      const i = sector * 4 + j;
      const price = Math.round((rules.colonyBasePrice + i * rules.colonyPriceIncrease / 39) / rules.colonyPriceStep) * rules.colonyPriceStep;
      nodes.push({ id: 0, name: lands[i], kind: 'island', price, toll: Math.round(price * rules.baseTollRate), specialty: goods[i % goods.length], ironYield: rules.ironYieldMin + i % rules.ironYieldVariants, x: 0, y: 0 });
      const specialStop = specials.find(([placedSector, afterColony]) => placedSector === sector && afterColony === j);
      if (specialStop) {
        const [, , special, name, chineseName] = specialStop;
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
    const [nextX, nextY] = coordinates[(index + 1) % coordinates.length];
    const segments = Math.max(1, Math.round(Math.hypot(nextX - x, nextY - y) * chartScale / rules.targetSeaSpacing));
    for (let j = 1; j < segments; j++) {
      const fraction = j / segments;
      sea++;
      map.push({
        id: map.length, kind: 'sea', name: `Open water ${sea}`, chineseName: `海上 ${sea}`,
        x: (x + (nextX - x) * fraction) * chartScale,
        y: (y + (nextY - y) * fraction) * chartScale,
      });
    }
  });
  for (const [from, to] of [[2, 8], [13, 20], [19, 21], [29, 32], [35, 39], [45, 54], [51, 54], [62, 66], [68, 71]]) {
    const id = stopIds[from];
    map[id].next = [(id + 1) % map.length, stopIds[to]];
  }
  return map;
}
