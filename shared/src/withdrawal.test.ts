import { describe, expect, it } from 'vitest';
import { battleAI, battleResult, createBattle, issueCommand, replayBattle, stepBattle, TICK } from './battle';
import { fightNavalBattle, forecastColonyBattle, forecastNavalBattle } from './combat';
import { GameEngine } from './engine';
import { SHIP_TYPES } from './ships';
import type { Ship } from './types';
import { withdrawalReason } from './withdrawal';

const ship = (id: number, overrides: Partial<Ship> = {}): Ship => ({ ...SHIP_TYPES.warship, id, type: 'warship', name: `Ship ${id}`, cargo: {}, maxDurability: 100, durability: 100, firepower: 0, ...overrides });
const fleet = (n: number) => Array.from({ length: n }, (_, i) => ship(i + 1));

function hitBattle(defenders: Ship[], damage: number) {
  const battle = createBattle({ seed: 42, attackers: [ship(100)], defenders });
  for (const s of battle.ships) s.order = { type: 'move', x: s.x, y: s.y };
  battle.cannonballs = battle.ships.filter((s) => s.side === 'defender').map((s) => ({ side: 'attacker', x: s.x, y: s.y, landingX: s.x, landingY: s.y, remaining: TICK, damage }));
  return battle;
}

describe('fleet withdrawal', () => {
  it.each([
    { attackers: [ship(1, { signature: true, durability: 25 }), ship(2)], defenders: [ship(100, { durability: 0 })], outcome: 'victory' },
    { attackers: [ship(1, { signature: true, durability: 25 }), ship(2)], defenders: [], outcome: 'victory' },
    { attackers: [ship(1, { durability: 0 })], defenders: [ship(100, { signature: true, durability: 25 }), ship(101)], outcome: 'defeat' },
    { attackers: [], defenders: [ship(100, { signature: true, durability: 25 }), ship(101)], outcome: 'defeat' },
    { attackers: [ship(1, { durability: 0 })], defenders: [ship(100, { durability: 0 })], outcome: 'defeat' },
    { attackers: [], defenders: [], outcome: 'defeat' },
  ])('prioritizes no afloat ships over crippled flagships: $outcome', ({ attackers, defenders, outcome }) => {
    const auto = fightNavalBattle(attackers, defenders, () => .5);
    expect(auto).toMatchObject({ outcome, rounds: 0, attackerSunk: [], defenderSunk: [] });
    const setup = { seed: 42, attackers, defenders };
    const battle = createBattle(setup);
    stepBattle(battle);
    expect(battleResult(battle)).toMatchObject({ outcome, ticks: 0, attackerSunk: [], defenderSunk: [] });
    expect(battleResult(battle).withdrawal).toBeUndefined();
    expect(replayBattle(setup, [])).toEqual(battleResult(battle));
  });

  it('leaves preexisting zero-durability ships inactive and does not count them as losses under Ambush', () => {
    const attackers = [ship(1, { durability: 0, signature: true, firepower: 10000 }), ship(2, { durability: 0 }), ship(3, { firepower: 10 })];
    const defenders = [ship(100)];
    const result = fightNavalBattle(attackers, defenders, () => .5, { skipFirstDefense: true });
    expect(result).toMatchObject({ outcome: 'draw', rounds: 3, attackerSunk: [], defenderSunk: [] });
    expect(defenders[0].durability).toBe(70);
    expect(attackers.map((s) => s.durability)).toEqual([0, 0, 100]);
    const setup = { seed: 42, attackers, defenders, ambush: true };
    const battle = createBattle(setup);
    stepBattle(battle);
    expect(battle.outcome).toBeNull();
    expect(battle.withdrawal).toBeNull();
    issueCommand(battle, 'defender', { type: 'retreat' });
    expect(battleResult(battle).attackerSunk).toEqual([]);
    expect(replayBattle(setup, [{ tick: 1, side: 'defender', cmd: { type: 'retreat' } }])).toEqual(battleResult(battle));
  });

  it.each([1, 2, 3, 4, 5, 6])('uses only the %i starting-afloat ships for caps and the lone-ship exception', (n) => {
    const defenders = [ship(20, { durability: 0, signature: true }), ship(21, { durability: 0 }), ...fleet(n)];
    const result = fightNavalBattle([ship(100, { firepower: 10000 })], defenders, () => .5);
    expect(result.outcome).toBe('victory');
    expect(result.defenderSunk).toHaveLength(Math.ceil(n / 2));
    expect(result.defenderSunk.every((s) => s.id < 20)).toBe(true);
    expect(defenders.slice(0, 2).map((s) => s.durability)).toEqual([0, 0]);
    const battle = hitBattle([ship(20, { durability: 0, signature: true }), ship(21, { durability: 0 }), ...fleet(n)], 10000);
    stepBattle(battle);
    const realtime = battleResult(battle);
    expect(realtime.outcome).toBe('victory');
    expect(realtime.defenderSunk).toHaveLength(Math.ceil(n / 2));
    expect(realtime.defenderSunk.every((id) => id < 20)).toBe(true);
    expect(realtime.durability.filter((s) => s.id === 20 || s.id === 21).map((s) => s.durability)).toEqual([0, 0]);
    if (n === 1) expect(realtime.withdrawal).toBeUndefined();
  });

  it('defeats an all-inactive fleet without reporting or removing preexisting losses', () => {
    const attackers = [ship(1, { durability: 0, firepower: 10000 })];
    const defenders = [ship(100)];
    expect(fightNavalBattle(attackers, defenders, () => .5)).toMatchObject({ outcome: 'defeat', rounds: 0, attackerSunk: [], defenderSunk: [] });
    expect(replayBattle({ seed: 42, attackers, defenders }, [])).toMatchObject({ outcome: 'defeat', ticks: 0, attackerSunk: [], defenderSunk: [] });
    expect(attackers[0].durability).toBe(0);
    expect(defenders[0].durability).toBe(100);
  });

  it('ignores empty and lone fleets and honors the exact half-loss threshold', () => {
    expect(withdrawalReason([])).toBeNull();
    expect(withdrawalReason([ship(1, { durability: 0, signature: true })])).toBeNull();
    const ships = fleet(5);
    ships[1].durability = ships[2].durability = 0;
    expect(withdrawalReason(ships)).toBeNull();
    ships[3].durability = 0;
    expect(withdrawalReason(ships)).toBe('losses');
  });

  it('chooses the signature flagship before maximum durability, then breaks ties by lowest id', () => {
    const ships = [ship(8), ship(3, { durability: 25 }), ship(9, { signature: true, durability: 26, maxDurability: 100 })];
    expect(withdrawalReason(ships)).toBeNull();
    ships[2].durability = 25;
    expect(withdrawalReason(ships)).toBe('flagship');
    delete ships[2].signature;
    expect(withdrawalReason(ships)).toBe('flagship');
    ships[0].maxDurability = 200;
    expect(withdrawalReason(ships)).toBeNull();
  });

  it.each([2, 3, 4, 5, 6, 7, 8, 9])('caps simultaneous lethal hits and auto volleys for %i ships', (n) => {
    const ships = fleet(n);
    const result = fightNavalBattle([ship(100, { firepower: 10000 })], ships, () => .5);
    expect(result).toMatchObject({ outcome: 'victory', rounds: 1, withdrawal: { side: 'defender', reason: 'losses' } });
    expect(result.defenderSunk.map((s) => s.id)).toEqual(ships.slice(0, Math.ceil(n / 2)).map((s) => s.id));
    expect(ships.filter((s) => s.durability > 0).every((s) => s.durability === 1)).toBe(true);
    const battle = hitBattle(fleet(n), 10000);
    stepBattle(battle);
    expect(battle.outcome).toBe('victory');
    expect(battleResult(battle).defenderSunk).toHaveLength(Math.ceil(n / 2));
    expect(battle.ships.filter((s) => s.side === 'defender' && !s.sunk).every((s) => s.durability === 1)).toBe(true);
  });

  it('ends a volley or tick as soon as the flagship reaches 25%, preserving damage and survivors', () => {
    const defenders = [ship(1, { signature: true, durability: 30 }), ship(2)];
    const result = fightNavalBattle([ship(100, { firepower: 5 })], defenders, () => .5);
    expect(result).toMatchObject({ outcome: 'victory', rounds: 1, defenderSunk: [], withdrawal: { side: 'defender', reason: 'flagship' } });
    expect(defenders[0].durability).toBe(25);
    const battle = hitBattle([ship(1, { signature: true }), ship(2)], 75);
    stepBattle(battle);
    expect(battleResult(battle)).toMatchObject({ outcome: 'victory', defenderSunk: [], withdrawal: { side: 'defender', reason: 'flagship' } });
  });

  it('lets a lone flagship sink in both resolvers', () => {
    expect(fightNavalBattle([ship(100, { firepower: 10000 })], [ship(1, { signature: true })], () => .5)).toMatchObject({ outcome: 'victory', defenderSunk: [{ id: 1 }] });
    const battle = hitBattle([ship(1, { signature: true })], 10000);
    stepBattle(battle);
    expect(battleResult(battle)).toMatchObject({ outcome: 'victory', defenderSunk: [1] });
    expect(battle.withdrawal).toBeNull();
  });

  it.each(['attacker', 'defender'] as const)('concedes %s defeat, preserves damage, and replays identically', (side) => {
    const setup = { seed: 42, attackers: [ship(1, { durability: 70 })], defenders: [ship(2, { durability: 80 })] };
    const log = [{ tick: 0, side, cmd: { type: 'retreat' as const } }];
    const battle = createBattle(setup);
    issueCommand(battle, side, log[0].cmd);
    expect(battle.outcome).toBe(side === 'attacker' ? 'defeat' : 'victory');
    expect(battle.ships.map((s) => s.durability)).toEqual([70, 80]);
    expect(replayBattle(setup, log)).toEqual(battleResult(battle));
    expect(replayBattle(setup, log)).toEqual(replayBattle(setup, log));
  });

  it('replays automatic flagship withdrawal deterministically', () => {
    const setup = { seed: 42, attackers: [ship(100)], defenders: [ship(1, { signature: true, durability: 25 }), ship(2)] };
    const live = createBattle(setup);
    stepBattle(live);
    expect(replayBattle(setup, [])).toEqual(battleResult(live));
    expect(replayBattle(setup, [])).toEqual(replayBattle(setup, []));
  });

  it.each(['attacker', 'defender'] as const)('lets hard AI concede an outmatched %s fleet', (side) => {
    const battle = createBattle({ seed: 1, attackers: [ship(1)], defenders: [ship(2)] });
    battle.ships.find((s) => s.side === side)!.durability = 20;
    battleAI(battle, side, 'hard');
    expect(battle.withdrawal).toEqual({ side, reason: 'retreat' });
    expect(battle.outcome).toBe(side === 'attacker' ? 'defeat' : 'victory');
  });

  it('forecasts flagship withdrawal without mutating ships, including colony forecasts', () => {
    const game = new GameEngine({ players: [{ name: 'A', color: 0, isAI: false }, { name: 'D', color: 1, isAI: true }] });
    const node = game.state.map.find((n) => n.kind === 'island')!;
    game.state.owners[node.id] = 1;
    game.currentPlayer.position = node.id;
    game.currentPlayer.fleet = [ship(100, { firepower: 5 })];
    game.state.players[1].fleet = [ship(1, { signature: true, durability: 30 }), ship(2)];
    const before = JSON.stringify(game.state.players);
    expect(forecastNavalBattle(game.currentPlayer.fleet, game.state.players[1].fleet)).toBe('victory');
    expect(forecastColonyBattle(game.state, game.currentPlayer)).toBe('victory');
    expect(JSON.stringify(game.state.players)).toBe(before);
  });
});
