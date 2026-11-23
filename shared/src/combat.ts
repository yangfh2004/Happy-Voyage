import type { BattleOutcome, GameState, Player, Ship } from './types';
import type { Rng } from './compass';
import { colonyToll } from './buildings';
import { STRATEGY_RULES } from './strategies';
import { sinkingCap, withdrawalReason, type BattleWithdrawal } from './withdrawal';

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
  withdrawal?: BattleWithdrawal;
}

/** Ships docked at the colony defend it; with none docked, the owner's fleet sails in. */
export function colonyDefenders(state: GameState, nodeId: number): { ships: Ship[]; owner: Player; fromFleet: boolean } {
  const owner = state.players[state.owners[nodeId]!];
  const docked = state.docks[nodeId] ?? [];
  return docked.length ? { ships: docked, owner, fromFleet: false } : { ships: owner.fleet, owner, fromFleet: true };
}

/** Toll owed at a rival colony. */
export function tollDue(state: GameState, _player: Player, nodeId: number, multiplier = 1): number {
  return colonyToll(state, nodeId) * multiplier;
}

function volley(ships: Ship[], rng: Rng, multiplier = 1): number {
  return ships.reduce((sum, ship) => sum + Math.round(ship.firepower * multiplier * (COMBAT.minRoll + rng() * COMBAT.rollSpread)), 0);
}

/** Cannon fire lands on the most battered ship first; overflow carries to the next. Returns ships sunk. */
function absorb(line: Ship[], damage: number, remainingSinks: number): Ship[] {
  const sunk: Ship[] = [];
  for (const ship of [...line].sort((a, b) => a.durability - b.durability)) {
    if (damage <= 0) break;
    const hit = Math.min(damage, ship.durability);
    ship.durability -= hit;
    damage -= hit;
    if (ship.durability === 0) {
      if (sunk.length < remainingSinks) sunk.push(ship);
      else ship.durability = 1;
    }
  }
  return sunk;
}

/**
 * Both lines fire simultaneously until a side is sunk, withdraws, or the rounds run out.
 * Mutates ship durability; the caller removes the sunk ships from their fleets.
 */
export function fightNavalBattle(attackers: Ship[], defenders: Ship[], rng: Rng, options: { attackerMultiplier?: number; defenderRng?: Rng; skipFirstDefense?: boolean } = {}): BattleResult {
  const attackFleet = attackers.filter((s) => s.durability > 0);
  const defenseFleet = defenders.filter((s) => s.durability > 0);
  let attackLine = [...attackFleet];
  let defenseLine = [...defenseFleet];
  const attackerSunk: Ship[] = [];
  const defenderSunk: Ship[] = [];
  let rounds = 0;
  let withdrawal: BattleWithdrawal | undefined;
  while (attackLine.length && defenseLine.length && rounds < COMBAT.rounds) {
    rounds += 1;
    const attackFire = volley(attackLine, rng, options.attackerMultiplier);
    const defenseFire = options.skipFirstDefense && rounds === 1 ? 0 : volley(defenseLine, options.defenderRng ?? rng);
    const lostDefenders = absorb(defenseLine, attackFire, sinkingCap(defenseFleet) - defenderSunk.length);
    const lostAttackers = absorb(attackLine, defenseFire, sinkingCap(attackFleet) - attackerSunk.length);
    defenderSunk.push(...lostDefenders);
    attackerSunk.push(...lostAttackers);
    defenseLine = defenseLine.filter((ship) => !lostDefenders.includes(ship));
    attackLine = attackLine.filter((ship) => !lostAttackers.includes(ship));
    const attackerReason = withdrawalReason(attackFleet), defenderReason = withdrawalReason(defenseFleet);
    if (!attackLine.length || attackerReason) { if (attackerReason) withdrawal = { side: 'attacker', reason: attackerReason }; break; }
    if (!defenseLine.length || defenderReason) { if (defenderReason) withdrawal = { side: 'defender', reason: defenderReason }; break; }
  }
  // Losing every ship is a defeat even if the last volley also sank the defenders.
  const outcome: BattleOutcome = !attackLine.length || withdrawal?.side === 'attacker' ? 'defeat' : !defenseLine.length || withdrawal?.side === 'defender' ? 'victory' : 'draw';
  return { outcome, rounds, attackerSunk, defenderSunk, ...(withdrawal ? { withdrawal } : {}) };
}

/** Forecast with the same withdrawal rules and loss caps, without touching real ships or match RNG. */
export function forecastNavalBattle(attackers: Ship[], defenders: Ship[], options: { attackerMultiplier?: number; attackerRoll?: number; defenderRoll?: number; skipFirstDefense?: boolean } = {}): BattleOutcome {
  const copy = (ships: Ship[]) => ships.map((ship) => ({ ...ship }));
  return fightNavalBattle(copy(attackers), copy(defenders), () => options.attackerRoll ?? 0.5, {
    attackerMultiplier: options.attackerMultiplier,
    skipFirstDefense: options.skipFirstDefense,
    defenderRng: () => options.defenderRoll ?? 0.5,
  }).outcome;
}

export function forecastColonyBattle(state: GameState, player: Player): BattleOutcome {
  return forecastNavalBattle(player.fleet, colonyDefenders(state, player.position).ships, {
    attackerMultiplier: state.inspired ? STRATEGY_RULES.inspireMultiplier : 1,
    skipFirstDefense: state.ambush,
  });
}
