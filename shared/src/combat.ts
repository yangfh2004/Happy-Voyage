import { discountedByCaptains } from './captains';
import type { BattleOutcome, GameState, Player, Ship } from './types';
import type { Rng } from './compass';
import { colonyToll } from './buildings';
import { STRATEGY_RULES } from './strategies';

export const COMBAT = {
  /** Volleys exchanged before an undecided battle is called a draw. */
  rounds: 3,
  /** Each ship's shot deals firepower × (minRoll … minRoll + rollSpread). */
  minRoll: 0.75,
  rollSpread: 0.5,
  defeatTollMultiplier: 2,
} as const;

export interface BattleResult {
  outcome: BattleOutcome;
  rounds: number;
  attackerSunk: Ship[];
  defenderSunk: Ship[];
}

/** Ships docked at the colony defend it; with none docked, the owner's fleet sails in. */
export function colonyDefenders(state: GameState, nodeId: number): { ships: Ship[]; owner: Player; fromFleet: boolean } {
  const owner = state.players[state.owners[nodeId]!];
  const docked = state.docks[nodeId] ?? [];
  return docked.length ? { ships: docked, owner, fromFleet: false } : { ships: owner.fleet, owner, fromFleet: true };
}

/** Toll the player owes at a rival colony, after their captains' discounts. */
export function tollDue(state: GameState, player: Player, nodeId: number, multiplier = 1): number {
  const base = colonyToll(state, nodeId) * multiplier;
  return discountedByCaptains(player, 'toll', base);
}

function volley(ships: Ship[], rng: Rng, multiplier = 1): number {
  return ships.reduce((sum, ship) => sum + Math.round(ship.firepower * multiplier * (COMBAT.minRoll + rng() * COMBAT.rollSpread)), 0);
}

/** Cannon fire lands on the most battered ship first; overflow carries to the next. Returns ships sunk. */
function absorb(line: Ship[], damage: number): Ship[] {
  const sunk: Ship[] = [];
  for (const ship of [...line].sort((a, b) => a.durability - b.durability)) {
    if (damage <= 0) break;
    const hit = Math.min(damage, ship.durability);
    ship.durability -= hit;
    damage -= hit;
    if (ship.durability === 0) sunk.push(ship);
  }
  return sunk;
}

/**
 * Both lines fire simultaneously each round until one side is sunk or the rounds run out.
 * Mutates ship durability; the caller removes the sunk ships from their fleets.
 */
export function fightNavalBattle(attackers: Ship[], defenders: Ship[], rng: Rng, options: { attackerMultiplier?: number; defenderRng?: Rng } = {}): BattleResult {
  let attackLine = [...attackers];
  let defenseLine = [...defenders];
  const attackerSunk: Ship[] = [];
  const defenderSunk: Ship[] = [];
  let rounds = 0;
  while (attackLine.length && defenseLine.length && rounds < COMBAT.rounds) {
    rounds += 1;
    const attackFire = volley(attackLine, rng, options.attackerMultiplier);
    const defenseFire = volley(defenseLine, options.defenderRng ?? rng);
    const lostDefenders = absorb(defenseLine, attackFire);
    const lostAttackers = absorb(attackLine, defenseFire);
    defenderSunk.push(...lostDefenders);
    attackerSunk.push(...lostAttackers);
    defenseLine = defenseLine.filter((ship) => !lostDefenders.includes(ship));
    attackLine = attackLine.filter((ship) => !lostAttackers.includes(ship));
  }
  // Losing every ship is a defeat even if the last volley also sank the defenders.
  const outcome: BattleOutcome = !attackLine.length ? 'defeat' : !defenseLine.length ? 'victory' : 'draw';
  return { outcome, rounds, attackerSunk, defenderSunk };
}

/** Result at fixed cannon rolls (average by default), without touching the real ships or match RNG. */
export function forecastNavalBattle(attackers: Ship[], defenders: Ship[], options: { attackerMultiplier?: number; attackerRoll?: number; defenderRoll?: number } = {}): BattleOutcome {
  const copy = (ships: Ship[]) => ships.map((ship) => ({ ...ship }));
  return fightNavalBattle(copy(attackers), copy(defenders), () => options.attackerRoll ?? 0.5, {
    attackerMultiplier: options.attackerMultiplier,
    defenderRng: () => options.defenderRoll ?? 0.5,
  }).outcome;
}

export function forecastColonyBattle(state: GameState, player: Player): BattleOutcome {
  return forecastNavalBattle(player.fleet, colonyDefenders(state, player.position).ships, {
    attackerMultiplier: state.inspired ? STRATEGY_RULES.inspireMultiplier : 1,
  });
}
