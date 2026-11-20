import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { SHIP_TYPES } from './ships';
import type { GameEvent, ShipType } from './types';

function visitColony() {
  const engine = new GameEngine({ players: [
    { name: 'Builder', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true },
  ], rng: () => 0 });
  engine.spinCompass();
  const nodeId = engine.sail().at(-1)!;
  engine.state.owners[nodeId] = 0;
  engine.resolveLanding();
  return { engine, nodeId, state: engine.state };
}

describe('colony shipyards', () => {
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
      expect(ship).toEqual({ ...stats, id, name: `${label} ${id}`, type, durability: stats.maxDurability });
      expect(engine.currentPlayer.fleet.at(-1)).toBe(ship);
      expect(engine.currentPlayer.gold).toBe(gold);
      expect(stock).toEqual(expectedStock);
      expect(events).toContainEqual({ type: 'shipAdded', playerId: 0, shipId: id });
      expect(state.log.at(-1)).toContain(`launches ${ship.name}`);
      expect(state.phase).toBe('awaitingBuild');
    }
    expect(state.players.map((player) => player.fleet.length)).toEqual([6, 3]);
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
