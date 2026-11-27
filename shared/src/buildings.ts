import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { BuildingKind, GameState } from './types';

export const BUILDINGS: Record<BuildingKind, { label: string; chineseName: string; maxLevel: number; costs: number[]; description: string }> = {
  lumberMill: { label: 'Lumber mill', chineseName: '木材厂', maxLevel: 3, get costs() { return Object.values(GAMEPLAY_TUNING.economy.buildings.lumberMill); }, description: 'Produces shipbuilding lumber each round.' },
  ironMine: { label: 'Iron mine', chineseName: '铁矿厂', maxLevel: 3, get costs() { return Object.values(GAMEPLAY_TUNING.economy.buildings.ironMine); }, description: 'Produces iron each round; yield varies by island.' },
  shipyard: { label: 'Shipyard', chineseName: '造船厂', maxLevel: 3, get costs() { return Object.values(GAMEPLAY_TUNING.economy.buildings.shipyard); }, description: "Builds ships with local lumber and iron. Larger yards unlock bigger ships. Fully repairs docked ships for free at the owner's turn start." },
  repairYard: { label: 'Repair yard', chineseName: '修船厂', maxLevel: 1, get costs() { return Object.values(GAMEPLAY_TUNING.economy.buildings.repairYard); }, description: "Fully repairs docked ships for free at the owner's turn start." },
  collectionField: { label: 'Collection field', chineseName: '采集场', maxLevel: 3, get costs() { return Object.values(GAMEPLAY_TUNING.economy.buildings.collectionField); }, description: 'Collects the local specialty each round.' },
  fort: { label: 'Shore forts', chineseName: '炮台', maxLevel: 3, get costs() { return Object.values(GAMEPLAY_TUNING.economy.buildings.fort); }, description: 'Three shore forts fire on attackers; raiders must beat the garrison and destroy all three to take the colony. Each level makes them sturdier and hit harder.' },
};

export const COLONY_PAYBACK_ROUNDS = GAMEPLAY_TUNING.economy.colonyPaybackRounds;

export function buildingLevel(state: GameState, nodeId: number, kind: BuildingKind): number {
  return state.buildings[nodeId]?.[kind] ?? 0;
}

export function colonyCanRepair(state: GameState, nodeId: number): boolean {
  return buildingLevel(state, nodeId, 'shipyard') > 0 || buildingLevel(state, nodeId, 'repairYard') > 0;
}

/** Shore forts defending a colony: none until a fort is built, then the same count at every level. */
export function colonyForts(state: GameState, nodeId: number): { durability: number; firepower: number }[] {
  const level = buildingLevel(state, nodeId, 'fort');
  const forts = GAMEPLAY_TUNING.combat.forts;
  return level > 0 ? Array.from({ length: forts.count }, () => ({ durability: forts.durabilityPerLevel * level, firepower: forts.firepowerPerLevel * level })) : [];
}

export function colonyProduction(state: GameState, nodeId: number) {
  const node = state.map[nodeId];
  return {
    lumber: buildingLevel(state, nodeId, 'lumberMill') * GAMEPLAY_TUNING.economy.lumberPerLevel,
    iron: buildingLevel(state, nodeId, 'ironMine') * (node.ironYield ?? 1),
    specialty: node.specialty ? buildingLevel(state, nodeId, 'collectionField') * GAMEPLAY_TUNING.economy.specialtyPerLevel : 0,
  };
}

export function nextBuildingCost(state: GameState, nodeId: number, kind: BuildingKind): number | null {
  if (!Object.prototype.hasOwnProperty.call(BUILDINGS, kind)) return null;
  return BUILDINGS[kind].costs[buildingLevel(state, nodeId, kind)] ?? null;
}

export function colonyToll(state: GameState, nodeId: number): number {
  const levels = Object.values(state.buildings[nodeId] ?? {}).reduce((sum, level) => sum + level, 0);
  return Math.floor((state.map[nodeId]?.toll ?? 0) * (1 + levels * GAMEPLAY_TUNING.economy.buildingTollRate));
}

function buildingInvestment(state: GameState, nodeId: number): number {
  return (Object.keys(BUILDINGS) as BuildingKind[]).reduce((sum, kind) =>
    sum + BUILDINGS[kind].costs.slice(0, buildingLevel(state, nodeId, kind)).reduce((total, cost) => total + cost, 0), 0);
}

export function colonyIncome(state: GameState, nodeId: number): number {
  return Math.floor(buildingInvestment(state, nodeId) / GAMEPLAY_TUNING.economy.colonyPaybackRounds);
}

export function buildingValue(state: GameState, nodeId: number): number {
  return Math.floor(buildingInvestment(state, nodeId) * GAMEPLAY_TUNING.economy.colonyResaleRate);
}
