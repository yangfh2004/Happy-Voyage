import type { BuildingKind, GameState } from './types';

export const BUILDINGS: Record<BuildingKind, { label: string; chineseName: string; maxLevel: number; costs: number[]; description: string }> = {
  lumberMill: { label: 'Lumber mill', chineseName: '木材厂', maxLevel: 3, costs: [100, 200, 300], description: 'Produces shipbuilding lumber each round.' },
  ironMine: { label: 'Iron mine', chineseName: '铁矿厂', maxLevel: 3, costs: [120, 240, 360], description: 'Produces iron each round; yield varies by island.' },
  shipyard: { label: 'Shipyard', chineseName: '造船厂', maxLevel: 3, costs: [200, 400, 600], description: 'Builds ships with local lumber and iron. Larger yards unlock bigger ships.' },
  repairYard: { label: 'Repair yard', chineseName: '修船厂', maxLevel: 1, costs: [150], description: 'Repairs ships (repairs coming later).' },
  collectionField: { label: 'Collection field', chineseName: '采集场', maxLevel: 3, costs: [80, 160, 240], description: 'Collects the local specialty each round.' },
};

export function buildingLevel(state: GameState, nodeId: number, kind: BuildingKind): number {
  return state.buildings[nodeId]?.[kind] ?? 0;
}

export function colonyProduction(state: GameState, nodeId: number) {
  const node = state.map[nodeId];
  return {
    lumber: buildingLevel(state, nodeId, 'lumberMill'),
    iron: buildingLevel(state, nodeId, 'ironMine') * (node.ironYield ?? 1),
    specialty: node.specialty ? buildingLevel(state, nodeId, 'collectionField') : 0,
  };
}

export function nextBuildingCost(state: GameState, nodeId: number, kind: BuildingKind): number | null {
  if (!Object.prototype.hasOwnProperty.call(BUILDINGS, kind)) return null;
  return BUILDINGS[kind].costs[buildingLevel(state, nodeId, kind)] ?? null;
}

export function colonyToll(state: GameState, nodeId: number): number {
  const levels = Object.values(state.buildings[nodeId] ?? {}).reduce((sum, level) => sum + level, 0);
  return Math.floor((state.map[nodeId]?.toll ?? 0) * (1 + levels * 0.25));
}

export function buildingValue(state: GameState, nodeId: number): number {
  const spent = (Object.keys(BUILDINGS) as BuildingKind[]).reduce((sum, kind) =>
    sum + BUILDINGS[kind].costs.slice(0, buildingLevel(state, nodeId, kind)).reduce((total, cost) => total + cost, 0), 0);
  return Math.floor(spent * 0.75);
}
