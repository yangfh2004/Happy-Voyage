import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { MAX_FLEET_SIZE } from './ships';
import type { Player } from './types';

function setup() {
  const engine = new GameEngine({
    players: [{ name: 'Builder', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: false }],
    rng: () => 0.5, config: { battleMode: 'auto', startingStrategies: 0 },
  });
  const { state } = engine;
  const [firstColony, secondColony] = state.map.filter((node) => node.kind === 'island').map((node) => node.id);
  const [player, rival] = state.players;
  const fill = (p: Player, size = MAX_FLEET_SIZE) => {
    while (p.fleet.length < size) engine.addShipToFleet(p.id, 'cargo');
  };
  const land = (id: number) => {
    engine.currentPlayer.position = id;
    state.phase = 'moving';
    engine.resolveLanding();
  };
  return { engine, state, player, rival, fill, land, firstColony, secondColony };
}

describe('sailing fleet limit', () => {
  it('stores new and used ships at the current colony and lets players swap them into the fleet', () => {
    const { engine, state, player, fill, land, firstColony, secondColony } = setup();
    fill(player, MAX_FLEET_SIZE - 1);
    state.owners[firstColony] = state.owners[secondColony] = player.id;
    state.buildings[secondColony].shipyard = 1;
    state.stockpiles[secondColony] = { lumber: 4, iron: 2, specialties: {} };
    land(secondColony);
    const last = engine.buildShip('explorer');
    expect(player.fleet.at(-1)).toBe(last);
    const built = engine.buildShip('explorer');
    const bought = engine.buyUsedShip('cargo');
    expect(built.durability).toBe(built.maxDurability);
    expect(bought.durability).toBe(60);
    expect(state.stockpiles[secondColony]).toEqual({ lumber: 0, iron: 0, specialties: {} });
    expect(state.docks[firstColony]).toEqual([]);
    expect(state.docks[secondColony]).toEqual([built, bought]);
    expect(() => engine.boardShip(built.id)).toThrow('Fleet is full');
    expect(state.docks[secondColony]).toEqual([built, bought]);
    engine.dockShip(last.id);
    engine.boardShip(built.id);
    expect(player.fleet).toHaveLength(MAX_FLEET_SIZE);
    expect(player.fleet.at(-1)).toBe(built);
    expect(state.docks[secondColony]).toEqual([bought, last]);
  });

  it('holds an off-colony purchase in reserve until the first colony is claimed', () => {
    const { engine, state, player, fill, land, firstColony } = setup();
    fill(player);
    land(state.map.find((node) => node.special === 'skeleton')!.id);
    const bought = engine.buyUsedShip('explorer');
    expect(player.fleet).toHaveLength(MAX_FLEET_SIZE);
    expect(player.reservedShips).toEqual([bought]);
    engine.finishMarket();
    state.currentPlayer = player.id;
    land(firstColony);
    expect(state.owners[firstColony]).toBe(player.id);
    expect(state.docks[firstColony]).toEqual([bought]);
    expect(player.reservedShips).toBeUndefined();
  });

  it('splits a multi-ship recruitment between the fleet and the first owned colony in chart order', () => {
    const { engine, state, player, fill, firstColony, secondColony } = setup();
    fill(player, MAX_FLEET_SIZE - 1);
    state.owners[firstColony] = state.owners[secondColony] = player.id;
    player.position = state.map.find((node) => node.special === 'dragonSnake')!.id;
    player.rank = 1;
    state.phase = 'awaitingRecruit';
    state.pendingRecruits = ['gaspar'];
    engine.recruitCaptain(0);
    expect(player.captains).toEqual(['gaspar']);
    expect(player.fleet).toHaveLength(MAX_FLEET_SIZE);
    expect(player.fleet.at(-1)?.type).toBe('explorer');
    expect(state.docks[firstColony]).toMatchObject([{ type: 'cargo', durability: 100 }]);
    expect(state.docks[secondColony]).toEqual([]);
  });

  it('keeps an overflow tax seizure at the host’s colony with its cargo intact', () => {
    const { state, player, rival, fill, land, firstColony } = setup();
    fill(rival);
    state.owners[firstColony] = rival.id;
    player.gold = 0;
    const seized = player.fleet.find((ship) => ship.type === 'explorer')!;
    seized.cargo.iron = 2;
    land(rival.homePort);
    expect(player.fleet).not.toContain(seized);
    expect(rival.fleet).toHaveLength(MAX_FLEET_SIZE);
    expect(state.docks[firstColony]).toEqual([seized]);
    expect(seized.cargo.iron).toBe(2);
  });

  it('moves overflow defenders to their owner’s remaining colony without changing battle outcome', () => {
    const { engine, state, player, rival, fill, land, firstColony, secondColony } = setup();
    state.owners[firstColony] = state.owners[secondColony] = rival.id;
    const guards = rival.fleet.splice(1, 2);
    for (const guard of guards) { guard.durability = 1; guard.firepower = 0; }
    const deployed = [...guards];
    fill(rival);
    state.docks[firstColony] = guards;
    for (const ship of player.fleet) ship.firepower = 1000;
    land(firstColony);
    const report = engine.fight()!;
    expect(report.outcome).toBe('victory');
    expect(state.owners[firstColony]).toBe(player.id);
    expect(state.docks[firstColony]).toEqual([]);
    expect(rival.fleet).toHaveLength(MAX_FLEET_SIZE);
    expect(report.defenderSunk).toHaveLength(1);
    expect(state.docks[secondColony]).toEqual(deployed.filter((ship) => !report.defenderSunk.includes(ship.name)));
  });

  it('docks defecting ships when the receiving fleet is full', () => {
    const { engine, state, player, rival, fill, firstColony } = setup();
    fill(player);
    state.owners[firstColony] = player.id;
    player.strategies = ['betray'];
    const expected = [...rival.fleet].sort((a, b) => b.firepower - a.firepower).slice(0, 3);
    engine.useStrategy('betray', rival.id);
    expect(player.fleet).toHaveLength(MAX_FLEET_SIZE);
    expect(state.docks[firstColony]).toEqual(expected);
    expect(rival.fleet).toHaveLength(5);
  });

  it('stops an AI from boarding once its sailing fleet is full', () => {
    const { engine, state, player, fill, land, firstColony } = setup();
    fill(player, MAX_FLEET_SIZE - 1);
    player.isAI = true;
    state.owners[firstColony] = player.id;
    land(firstColony);
    const toBoard = engine.addShipToFleet(player.id, 'explorer');
    const staysDocked = engine.addShipToFleet(player.id, 'warship');
    engine.dockShip(toBoard.id);
    state.docks[firstColony].reverse();
    engine.decideForAI();
    expect(player.fleet).toHaveLength(MAX_FLEET_SIZE);
    expect(player.fleet).toContain(toBoard);
    expect(state.docks[firstColony]).toEqual([staysDocked]);
  });
});
