import { cargoLoad, type Ship } from '@happy-voyage/shared';

export interface FleetSummary {
  durability: number;
  maxDurability: number;
  percent: number;
  damaged: number;
  firepower: number;
  cargoUsed: number;
  cargoCapacity: number;
}

export function fleetDurabilitySummary(ships: readonly Ship[]): FleetSummary {
  let durability = 0;
  let maxDurability = 0;
  let damaged = 0;
  let firepower = 0;
  let cargoUsed = 0;
  let cargoCapacity = 0;
  for (const ship of ships) {
    durability += ship.durability;
    maxDurability += ship.maxDurability;
    if (ship.durability < ship.maxDurability) damaged += 1;
    firepower += ship.firepower;
    cargoUsed += cargoLoad(ship);
    cargoCapacity += ship.cargoCapacity;
  }
  const percent = maxDurability > 0 ? Math.round((durability / maxDurability) * 100) : 0;
  return { durability, maxDurability, percent, damaged, firepower, cargoUsed, cargoCapacity };
}
