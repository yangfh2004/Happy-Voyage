import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { COLONY_RETURN_COOLDOWN } from './rules';
import { SHIP_TYPES } from './ships';
import type { GameEvent, ShipType } from './types';

function visitColony() {
  const engine = new GameEngine({ players: [
    { name: 'Builder', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true },
  ], rng: () => 0, config: { battleMode: 'auto' } });
  engine.spinCompass();
  const nodeId = engine.sail().at(-1)!;
  engine.state.owners[nodeId] = 0;
  engine.resolveLanding();
  return { engine, nodeId, state: engine.state };
}

describe('colony shipyards', () => {
  it('can prepare its only colony and return later to launch a ship without rolling the compass', () => {
    const { engine, nodeId, state } = visitColony();
    const player = engine.currentPlayer;
    const rivalColony = state.map.find((node) => node.kind === 'island' && node.id !== nodeId)!;
    state.owners[rivalColony.id] = 1;
    expect(engine.colonyReturnTargets()).toEqual([]);

    player.position = player.homePort;
    state.phase = 'awaitingSpin';
    state.lastSpin = null;
    expect(engine.colonyReturnTargets().map((node) => node.id)).toEqual([nodeId]);
    expect(() => engine.returnToColony(rivalColony.id)).toThrow('Cannot return');
    engine.returnToColony(nodeId);
    expect(state).toMatchObject({ phase: 'awaitingBuild', lastSpin: null });
    expect(player.position).toBe(nodeId);
    for (const building of ['lumberMill', 'ironMine', 'shipyard'] as const) engine.build(building);
    engine.finishBuilding();

    state.currentPlayer = player.id;
    player.position = player.homePort;
    state.round = COLONY_RETURN_COOLDOWN;
    expect(() => engine.returnToColony(nodeId)).toThrow('Cannot return');
    expect(engine.colonyReturnTargets()).toEqual([]);
    state.round++;
    state.stockpiles[nodeId].lumber = 2;
    state.stockpiles[nodeId].iron = 1;
    engine.returnToColony(nodeId);
    expect(engine.buildShip('explorer').type).toBe('explorer');
  });

  it('lets a depleted AI return to a stocked colony to build a ship', () => {
    const { engine, nodeId, state } = visitColony();
    const player = engine.currentPlayer;
    player.isAI = true;
    player.fleet.splice(2);
    player.position = player.homePort;
    state.phase = 'awaitingSpin';
    state.buildings[nodeId].shipyard = 1;
    state.stockpiles[nodeId].lumber = 2;
    state.stockpiles[nodeId].iron = 1;

    engine.decideForAI();
    expect(player.position).toBe(nodeId);
    expect(state.phase).toBe('awaitingBuild');
    engine.decideForAI();
    expect(player.fleet).toHaveLength(3);
  });

  it('unlocks ships by yard size and commissions them from local materials', () => {
    const { engine, nodeId, state } = visitColony();
    const stock = state.stockpiles[nodeId] = { lumber: 12, iron: 7, specialties: { Wine: 3 } };
    const events: GameEvent[] = [];
    engine.on((event) => events.push(event));
    const types: ShipType[] = ['explorer', 'cargo', 'warship'];
    const costs = [[2, 1], [4, 2], [6, 4]];

    expect(types.map((type) => engine.canBuildShip(type))).toEqual([false, false, false]);
    for (const [index, type] of types.entries()) {
      engine.build('shipyard');
      expect(types.map((candidate) => engine.canBuildShip(candidate))).toEqual(types.map((_, i) => i <= index));
      const { label, ...stats } = SHIP_TYPES[type];
      const [lumber, iron] = costs[index];
      const expectedStock = { ...stock, lumber: stock.lumber - lumber, iron: stock.iron - iron };
      const gold = engine.currentPlayer.gold;
      const id = state.nextShipId;
      const ship = engine.buildShip(type);
      expect(ship).toEqual({ ...stats, id, name: `${label} ${id}`, type, durability: stats.maxDurability, cargo: {} });
      expect(engine.currentPlayer.fleet.at(-1)).toBe(ship);
      expect(engine.currentPlayer.gold).toBe(gold);
      expect(stock).toEqual(expectedStock);
      expect(events).toContainEqual({ type: 'shipAdded', playerId: 0, shipId: id });
      expect(state.log.at(-1)).toContain(`launches ${ship.name}`);
      expect(state.phase).toBe('awaitingBuild');
    }
    expect(state.players.map((player) => player.fleet.length)).toEqual([8, 5]);
    expect(stock).toEqual({ lumber: 0, iron: 0, specialties: { Wine: 3 } });
    expect(engine.canBuildShip('explorer')).toBe(false);
  });

  it('rejects invalid orders without spending materials, adding ships or emitting events', () => {
    const { engine, nodeId, state } = visitColony();
    const events: GameEvent[] = [];
    engine.on((event) => events.push(event));
    const stock = state.stockpiles[nodeId];
    const building = state.buildings[nodeId];
    const otherIsland = state.map.find((node) => node.kind === 'island' && node.id !== nodeId)!;
    state.stockpiles[otherIsland.id] = { lumber: 99, iron: 99, specialties: {} };

    function refuse(type: ShipType) {
      const before = structuredClone(state);
      expect(engine.canBuildShip(type)).toBe(false);
      expect(() => engine.buildShip(type)).toThrow();
      expect(state).toEqual(before);
      expect(events).toEqual([]);
    }

    stock.lumber = 2;
    stock.iron = 1;
    refuse('explorer');
    building.shipyard = 1;
    refuse('constructor' as ShipType);
    refuse('cargo');
    stock.lumber = 1;
    refuse('explorer');
    stock.lumber = 2;
    stock.iron = 0;
    refuse('explorer');
    stock.iron = 1;
    state.owners[nodeId] = 1;
    refuse('explorer');
    state.owners[nodeId] = 0;
    state.phase = 'awaitingSpin';
    refuse('explorer');
  });
});
