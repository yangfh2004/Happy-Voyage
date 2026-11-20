import type { Ship, ShipStats, ShipType } from './types';

export function cargoLoad(ship: Ship): number {
  return Object.values(ship.cargo).reduce((sum, qty) => sum + (qty ?? 0), 0);
}

export const GOODS = ['lumber', 'iron', 'Wine', 'Sugar', 'Cotton', 'Timber', 'Cocoa', 'Tobacco', 'Silver', 'Spices', 'Silk', 'Tea'] as const;

export const SHIP_TYPES = {
  warship: { label: 'Warship', maxDurability: 120, firepower: 30, cargoCapacity: 25, speed: 4, crewCapacity: 60 },
  cargo: { label: 'Cargo Ship', maxDurability: 100, firepower: 8, cargoCapacity: 120, speed: 3, crewCapacity: 30 },
  explorer: { label: 'Explorer', maxDurability: 80, firepower: 12, cargoCapacity: 40, speed: 7, crewCapacity: 25 },
} as const satisfies Record<ShipType, ShipStats & { label: string }>;

export const STARTING_FLEET: readonly ShipType[] = ['warship', 'cargo', 'explorer'];

export const SHIP_RECIPES = {
  explorer: { yardLevel: 1, lumber: 2, iron: 1 },
  cargo: { yardLevel: 2, lumber: 4, iron: 2 },
  warship: { yardLevel: 3, lumber: 6, iron: 4 },
} as const satisfies Record<ShipType, { yardLevel: number; lumber: number; iron: number }>;
