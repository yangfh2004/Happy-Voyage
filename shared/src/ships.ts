import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { Ship, ShipStats, ShipType } from './types';

export function cargoLoad(ship: Ship): number {
  return Object.values(ship.cargo).reduce((sum, qty) => sum + (qty ?? 0), 0);
}

export const GOODS = ['lumber', 'iron', 'Wine', 'Sugar', 'Cotton', 'Timber', 'Cocoa', 'Tobacco', 'Silver', 'Spices', 'Silk', 'Tea'] as const;

const labels = { warship: 'Warship', cargo: 'Cargo Ship', explorer: 'Explorer' } as const;

function shipStats(type: ShipType): ShipStats & { label: string } {
  return {
    label: labels[type],
    get maxDurability() { return GAMEPLAY_TUNING.ships[type].durability; },
    get firepower() { return GAMEPLAY_TUNING.ships[type].firepower; },
    get cargoCapacity() { return GAMEPLAY_TUNING.ships[type].cargo; },
    get speed() { return GAMEPLAY_TUNING.ships[type].speed; },
    get crewCapacity() { return GAMEPLAY_TUNING.ships[type].crew; },
  };
}

export const SHIP_TYPES = { warship: shipStats('warship'), cargo: shipStats('cargo'), explorer: shipStats('explorer') };
export const STARTING_FLEET: readonly ShipType[] = GAMEPLAY_TUNING.starting.fleet;
export const MAX_FLEET_SIZE = GAMEPLAY_TUNING.ships.maxFleetSize;

export const USED_SHIP_PRICES: Record<ShipType, number> = {
  get explorer() { return GAMEPLAY_TUNING.ships.explorer.usedPrice; },
  get cargo() { return GAMEPLAY_TUNING.ships.cargo.usedPrice; },
  get warship() { return GAMEPLAY_TUNING.ships.warship.usedPrice; },
};
export const USED_SHIP_CONDITION = GAMEPLAY_TUNING.ships.usedCondition;

export function shipSalePrice(ship: Ship): number {
  return Math.floor(USED_SHIP_PRICES[ship.type] * GAMEPLAY_TUNING.ships.saleMultiplier * Math.max(0, Math.min(1, ship.durability / ship.maxDurability)));
}

export const SHIP_RECIPES = {
  explorer: GAMEPLAY_TUNING.ships.explorer,
  cargo: GAMEPLAY_TUNING.ships.cargo,
  warship: GAMEPLAY_TUNING.ships.warship,
};
