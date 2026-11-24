import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { aiShouldFight } from './ai';
import { colonyToll } from './buildings';
import { fightNavalBattle } from './combat';
import type { GameEvent, Ship } from './types';

const players = [{ name: 'Owner', color: 0, isAI: true }, { name: 'Raider', color: 1, isAI: true }];

/** Owner holds island 1; Raider lands there with an even-roll compass. */
function siege(attackerHp: number, defenderHp: number, thirdSeat = false) {
  const engine = new GameEngine({ players: thirdSeat ? [...players, { name: 'Another rival', color: 2, isAI: true }] : players, config: { startingGold: 1000 }, rng: () => 0.5 });
  const { state } = engine;
  const island = state.map.find((node) => node.kind === 'island')!;
  const [owner, raider] = state.players;
  state.owners[island.id] = owner.id;
  owner.position = island.id + 3;
  owner.fleet.forEach((ship) => { ship.durability = defenderHp; });
  raider.fleet.forEach((ship) => { ship.durability = attackerHp; });
  state.currentPlayer = raider.id;
  raider.position = island.id;
  state.phase = 'moving';
  const events: GameEvent[] = [];
  engine.on((event) => events.push(event));
  engine.resolveLanding();
  return { engine, state, island, owner, raider, events };
}

describe('naval combat', () => {
  it('offers the toll-or-fight choice on a rival colony', () => {
    const { state, events, raider, owner, island, engine } = siege(100, 100);
    expect(state.phase).toBe('awaitingToll');
    expect(events).toContainEqual({ type: 'tollOffered', playerId: raider.id, nodeId: island.id });
    engine.payToll();
    expect(raider.gold).toBe(1000 - colonyToll(state, island.id));
    expect(owner.gold).toBe(1000 + colonyToll(state, island.id));
    expect(state.battles).toEqual([]);
    expect(state.phase).toBe('awaitingSpin');
  });

  it('takes the colony when defenders withdraw and preserves their surviving ships', () => {
    const { engine, state, island, owner, raider, events } = siege(200, 1);
    const report = engine.fight()!;
    expect(report).toMatchObject({ outcome: 'victory', attacker: raider.id, defender: owner.id, nodeId: island.id, rounds: 1, tollPaid: 0 });
    expect(report.defenderSunk).toHaveLength(3);
    expect(report.attackerSunk).toEqual([]);
    expect(owner.fleet).toHaveLength(2);
    expect(owner.fleet.every((s) => s.durability === 1)).toBe(true);
    expect(raider.fleet).toHaveLength(5);
    expect(state.owners[island.id]).toBe(raider.id);
    expect(raider.gold).toBe(1000);
    expect(state.battles).toEqual([report]);
    expect(events).toContainEqual({ type: 'battleFought', report });
    expect(events).toContainEqual({ type: 'claimed', playerId: raider.id, nodeId: island.id });
    expect(owner.fleetLost).toBeUndefined();
    expect(state.winner).toBeNull();
  });

  it('caps attacker losses and charges double toll on defeat', () => {
    const { engine, state, island, owner, raider } = siege(1, 100);
    const toll = colonyToll(state, island.id) * 2;
    const report = engine.fight()!;
    expect(report).toMatchObject({ outcome: 'defeat', tollPaid: toll });
    expect(report.attackerSunk).toHaveLength(3);
    expect(raider.fleet).toHaveLength(2);
    expect(owner.fleet).toHaveLength(5);
    expect(raider.gold).toBe(1000 - toll);
    expect(owner.gold).toBe(1000 + toll);
    expect(state.owners[island.id]).toBe(owner.id);
    expect(state.battles).toEqual([report]);
    expect(raider).toMatchObject({ bankrupt: false });
    expect(raider.fleetLost).toBeUndefined();
    expect(state.winner).toBeNull();
  });

  it('keeps a withdrawing navigator’s other colonies and next turn', () => {
    const { engine, state, owner, island } = siege(200, 1, true);
    const other = state.map.find((node) => node.kind === 'island' && node.id !== island.id)!;
    state.owners[other.id] = owner.id;
    state.buildings[other.id] = { shipyard: 1 };
    engine.fight();
    expect(state.owners[other.id]).toBe(owner.id);
    expect(state.buildings[other.id]).toEqual({ shipyard: 1 });
    engine.finishBuilding();
    expect(state.currentPlayer).toBe(2);
    engine.currentPlayer.position = engine.currentPlayer.homePort;
    state.phase = 'moving';
    engine.resolveLanding();
    expect(state).toMatchObject({ phase: 'awaitingSpin', currentPlayer: owner.id, winner: null });
  });

  it('keeps both fleets afloat if both reach the withdrawal cap', () => {
    const { engine, state, owner, raider, events } = siege(1, 1);
    engine.fight();
    expect(owner.fleet).toHaveLength(2);
    expect(raider.fleet).toHaveLength(2);
    expect(state.battles[0].outcome).toBe('defeat');
    expect(state.winner).toBeNull();
    expect(events.filter((event) => event.type === 'gameOver')).toEqual([]);
  });

  it('sends both fleets home after a drawn battle', () => {
    const { engine, state, island, owner, raider } = siege(1000, 1000);
    const report = engine.fight()!;
    expect(report).toMatchObject({ outcome: 'draw', rounds: 3, attackerSunk: [], defenderSunk: [], tollPaid: 0 });
    expect(raider.position).toBe(raider.homePort);
    expect(owner.position).toBe(owner.homePort);
    expect(raider.fleet.some((ship) => ship.durability < 1000)).toBe(true);
    expect(owner.fleet.some((ship) => ship.durability < 1000)).toBe(true);
    expect(state.owners[island.id]).toBe(owner.id);
    expect(raider.gold).toBe(1000);
    expect(state.battles).toEqual([report]);
  });

  it('records every battle in order', () => {
    const first = siege(1000, 1000);
    first.engine.fight();
    const { state, engine, owner, island } = first;
    owner.fleet.forEach((ship) => { ship.durability = 1; });
    state.currentPlayer = 1;
    state.players[1].position = island.id;
    state.phase = 'moving';
    engine.resolveLanding();
    engine.fight();
    expect(state.battles.map((battle) => battle.outcome)).toEqual(['draw', 'victory']);
  });

  it('defends with docked ships when the colony has any', () => {
    const { engine, state, island, owner, raider } = siege(100, 100);
    const guard = owner.fleet.shift()!;
    guard.durability = 1;
    state.docks[island.id] = [guard];
    const report = engine.fight()!;
    expect(report.outcome).toBe('victory');
    expect(report.defenderSunk).toEqual([guard.name]);
    expect(state.docks[island.id]).toEqual([]);
    expect(owner.fleet).toHaveLength(4);
    expect(owner.fleetLost).toBeUndefined();
    expect(state.owners[island.id]).toBe(raider.id);
  });

  it('charges the toll directly and ends the voyage when the visitor has no ships', () => {
    const engine = new GameEngine({ players, rng: () => 0.5 });
    const { state } = engine;
    const island = state.map.find((node) => node.kind === 'island')!;
    state.owners[island.id] = 0;
    state.currentPlayer = 1;
    state.players[1].fleet = [];
    state.players[1].position = island.id;
    state.phase = 'moving';
    engine.resolveLanding();
    expect(state).toMatchObject({ phase: 'gameOver', winner: 0 });
    expect(state.players[1].gold).toBe(state.config.startingGold - colonyToll(state, island.id));
  });

  it('lets the AI fight a battle it expects to win and pay otherwise', () => {
    const strong = siege(200, 1);
    expect(aiShouldFight(strong.state, strong.raider)).toBe(true);
    strong.engine.decideForAI();
    expect(strong.state.battles[0].outcome).toBe('victory');
    const weak = siege(1, 100);
    expect(aiShouldFight(weak.state, weak.raider)).toBe(false);
    weak.engine.decideForAI();
    expect(weak.state.battles).toEqual([]);
  });

  it('counts mutual destruction as a defeat', () => {
    const ship = (id: number, durability: number, firepower: number) => ({ id, durability, firepower }) as Ship;
    const result = fightNavalBattle([ship(1, 10, 20)], [ship(2, 10, 20)], () => 0.5);
    expect(result).toMatchObject({ outcome: 'defeat', rounds: 1 });
    expect(result.attackerSunk).toHaveLength(1);
    expect(result.defenderSunk).toHaveLength(1);
  });

  it('spreads overflowing damage from the weakest ship onward', () => {
    const ship = (id: number, durability: number, firepower = 0) => ({ id, durability, firepower }) as Ship;
    const defenders = [ship(1, 50), ship(2, 5), ship(3, 20)];
    const result = fightNavalBattle([ship(9, 100, 30)], defenders, () => 0.5);
    expect(result.defenderSunk.map((s) => s.id)).toEqual([2, 3]);
    expect(defenders[0].durability).toBe(45);
    expect(result).toMatchObject({ outcome: 'victory', rounds: 1, withdrawal: { side: 'defender', reason: 'losses' } });
  });
});
