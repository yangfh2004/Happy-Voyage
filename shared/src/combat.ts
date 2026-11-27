import { DEFAULT_GAMEPLAY_TUNING, GAMEPLAY_TUNING } from './gameplayTuning';
import type { BattleOutcome, GameConfig, GameState, Player, Ship } from './types';
import type { Rng } from './compass';
import { colonyForts, colonyToll } from './buildings';
import { STRATEGY_RULES } from './strategies';
import { playerRetreatThreshold, sinkingCap, withdrawalReason, type BattleWithdrawal, type RetreatThreshold } from './withdrawal';

export const COMBAT = GAMEPLAY_TUNING.combat;

export function defaultBattleDeployment(fleet: Ship[]): Ship[] {
  const afloat = fleet.filter((ship) => ship.durability > 0);
  const combatShips = afloat.filter((ship) => ship.type !== 'cargo');
  return (combatShips.length ? combatShips : afloat)
    .sort((a, b) => Number(b.type === 'warship') - Number(a.type === 'warship')
      || b.firepower - a.firepower || b.durability - a.durability || a.id - b.id)
    .slice(0, combatShips.length ? COMBAT.deploymentLimit : 1);
}

export function selectBattleDeployment(fleet: Ship[], shipIds?: number[]): Ship[] {
  if (shipIds === undefined) return defaultBattleDeployment(fleet);
  const ids = new Set(shipIds);
  const deployment = fleet.filter((ship) => ship.durability > 0 && ids.has(ship.id));
  if (ids.size !== shipIds.length || ids.size !== deployment.length || ids.size < 1 || ids.size > COMBAT.deploymentLimit) {
    throw new Error('Invalid battle deployment');
  }
  return deployment;
}

export interface BattleResult {
  outcome: BattleOutcome;
  rounds: number;
  attackerSunk: Ship[];
  defenderSunk: Ship[];
  withdrawal?: BattleWithdrawal;
  /** Shore forts destroyed; forts only defend colonies. */
  fortsDestroyed?: number;
}

export type FortSetup = { durability: number; firepower: number };

/** Ships docked at the colony defend it; with none docked, the owner's fleet sails in. */
export function colonyDefenders(state: GameState, nodeId: number): { ships: Ship[]; owner: Player; fromFleet: boolean } {
  const owner = state.players[state.owners[nodeId]!];
  const docked = state.docks[nodeId] ?? [];
  return docked.length ? { ships: docked, owner, fromFleet: false } : { ships: owner.fleet, owner, fromFleet: true };
}

export function colonyBattleMode(state: GameState, attacker: Player, defender: Player): GameConfig['battleMode'] {
  return attacker.isAI && defender.isAI ? 'auto' : state.config.battleMode;
}

/** Toll owed at a rival colony. */
export function tollDue(state: GameState, _player: Player, nodeId: number, multiplier = 1): number {
  return colonyToll(state, nodeId) * multiplier;
}

function volley(ships: Ship[], rng: Rng, hitRng: Rng, multiplier = 1, forecastAccuracy?: number): number {
  const damage = ships.reduce((sum, ship) => forecastAccuracy === undefined && hitRng() >= COMBAT.hitChance ? sum
    : sum + Math.round(ship.firepower * multiplier * (COMBAT.minRoll + rng() * COMBAT.rollSpread)), 0);
  return damage * (forecastAccuracy ?? 1);
}

/** Cannon fire lands on the most battered ship first; overflow carries to the next. Returns ships sunk and unspent damage. */
function absorb(line: Ship[], damage: number, remainingSinks: number): Ship[] & { rest?: number } {
  const sunk: Ship[] & { rest?: number } = [];
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
  sunk.rest = damage;
  return sunk;
}

type BattleOptions = { forts?: FortSetup[]; attackerMultiplier?: number; defenderRng?: Rng; hitRng?: Rng; skipFirstDefense?: boolean; attackerThreshold?: RetreatThreshold; defenderThreshold?: RetreatThreshold };

/**
 * Both lines fire simultaneously until a side is sunk, withdraws, or the rounds run out.
 * Mutates ship durability; the caller removes the sunk ships from their fleets.
 */
export function fightNavalBattle(attackers: Ship[], defenders: Ship[], rng: Rng, options: BattleOptions = {}): BattleResult {
  return resolveNavalBattle(attackers, defenders, rng, options);
}

function resolveNavalBattle(attackers: Ship[], defenders: Ship[], rng: Rng, options: BattleOptions, forecastAccuracy?: number): BattleResult {
  const attackFleet = attackers.filter((s) => s.durability > 0);
  const defenseFleet = defenders.filter((s) => s.durability > 0);
  let attackLine = [...attackFleet];
  let defenseLine = [...defenseFleet];
  // Forts fight on after the garrison is gone and have no loss cap; the attacker must destroy every one.
  let fortLine: Ship[] = (options.forts ?? []).map((fort, i) => ({ id: -(i + 1), name: `Fort ${i + 1}`, type: 'warship', cargo: {}, durability: fort.durability, maxDurability: fort.durability, firepower: fort.firepower, cargoCapacity: 0, speed: 0, crewCapacity: 0 }));
  const forts = fortLine.length;
  const attackerSunk: Ship[] = [];
  const defenderSunk: Ship[] = [];
  let rounds = 0;
  let withdrawal: BattleWithdrawal | undefined;
  let garrisonWithdrawal: BattleWithdrawal | undefined;
  while (attackLine.length && (defenseLine.length || fortLine.length) && rounds < COMBAT.rounds) {
    rounds += 1;
    const attackFire = volley(attackLine, rng, options.hitRng ?? rng, options.attackerMultiplier, forecastAccuracy);
    const defenseMultiplier = options.skipFirstDefense && rounds === 1 ? STRATEGY_RULES.ambushDefenseMultiplier : 1;
    const defenseFire = volley(defenseLine, options.defenderRng ?? rng, options.hitRng ?? rng, defenseMultiplier, forecastAccuracy)
      + volley(fortLine, options.defenderRng ?? rng, options.hitRng ?? rng, defenseMultiplier, forecastAccuracy);
    const lostDefenders = absorb(defenseLine, attackFire, sinkingCap(defenseFleet, options.defenderThreshold) - defenderSunk.length);
    const lostForts = absorb(fortLine, lostDefenders.rest ?? attackFire, forts);
    const lostAttackers = absorb(attackLine, defenseFire, sinkingCap(attackFleet, options.attackerThreshold) - attackerSunk.length);
    defenderSunk.push(...lostDefenders);
    attackerSunk.push(...lostAttackers);
    defenseLine = defenseLine.filter((ship) => !lostDefenders.includes(ship));
    fortLine = fortLine.filter((fort) => !lostForts.includes(fort));
    attackLine = attackLine.filter((ship) => !lostAttackers.includes(ship));
    const attackerReason = withdrawalReason(attackFleet, options.attackerThreshold);
    const defenderReason = garrisonWithdrawal ? null : withdrawalReason(defenseFleet, options.defenderThreshold);
    if (!attackLine.length || attackerReason) { if (attackerReason) withdrawal = { side: 'attacker', reason: attackerReason }; break; }
    if (defenderReason) { garrisonWithdrawal = { side: 'defender', reason: defenderReason }; defenseLine = []; }
    if (!defenseLine.length && !fortLine.length) { withdrawal = garrisonWithdrawal; break; }
  }
  // Losing every ship is a defeat even if the last volley also sank the defenders.
  const outcome: BattleOutcome = !attackLine.length || withdrawal?.side === 'attacker' ? 'defeat' : !defenseLine.length && !fortLine.length ? 'victory' : 'draw';
  return { outcome, rounds, attackerSunk, defenderSunk, ...(withdrawal ? { withdrawal } : {}), ...(forts ? { fortsDestroyed: forts - fortLine.length } : {}) };
}

/** Forecast with the same withdrawal rules and loss caps, without touching real ships or match RNG. */
export function forecastNavalBattle(attackers: Ship[], defenders: Ship[], options: { battleMode?: GameConfig['battleMode']; attackerMultiplier?: number; attackerRoll?: number; defenderRoll?: number; skipFirstDefense?: boolean; attackerThreshold?: RetreatThreshold; defenderThreshold?: RetreatThreshold; forts?: FortSetup[] } = {}): BattleOutcome {
  const copy = (ships: Ship[]) => ships.map((ship) => ({ ...ship }));
  // Keep the stock full-hit estimate, scaling forecast damage down for lower accuracy.
  const accuracy = options.battleMode === 'realtime' ? 1 : Math.min(1, COMBAT.hitChance / DEFAULT_GAMEPLAY_TUNING.combat.hitChance);
  return resolveNavalBattle(copy(attackers), copy(defenders), () => options.attackerRoll ?? 0.5, {
    attackerMultiplier: options.attackerMultiplier,
    attackerThreshold: options.attackerThreshold, defenderThreshold: options.defenderThreshold,
    skipFirstDefense: options.skipFirstDefense, forts: options.forts,
    defenderRng: () => options.defenderRoll ?? 0.5,
  }, accuracy).outcome;
}

export function forecastColonyBattle(state: GameState, player: Player, shipIds?: number[]): BattleOutcome {
  const { ships, owner } = colonyDefenders(state, player.position);
  return forecastNavalBattle(selectBattleDeployment(player.fleet, shipIds), defaultBattleDeployment(ships), {
    battleMode: colonyBattleMode(state, player, owner),
    attackerThreshold: playerRetreatThreshold(player), defenderThreshold: playerRetreatThreshold(owner),
    attackerMultiplier: state.inspired ? STRATEGY_RULES.inspireMultiplier : 1,
    skipFirstDefense: state.ambush, forts: colonyForts(state, player.position),
  });
}
