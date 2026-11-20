import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { cargoLoad } from './ships';
import type { Good } from './types';

function visit() {
  const engine = new GameEngine({ players: [
    { name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true },
  ] });
  const { state } = engine;
  const node = state.map.find((n) => n.kind === 'island')!;
  engine.currentPlayer.position = node.id;
  state.owners[node.id] = 0;
  state.phase = 'moving';
  engine.resolveLanding();
  const stock = state.stockpiles[node.id];
  const ship = engine.currentPlayer.fleet[0];
  return { engine, state, node, stock, ship };
}

describe('colony transfers', () => {
  it('docks and boards the same ship with its cargo, retaining at least one fleet ship', () => {
    const { engine, state, node, ship, stock } = visit();
    const events: string[] = [];
    engine.on((event) => events.push(event.type));
    stock.lumber = 3;
    engine.loadCargo(ship.id, 'lumber', 3);
    engine.dockShip(ship.id);
    expect(state.docks[node.id]).toEqual([ship]);
    expect(ship.cargo).toEqual({ lumber: 3 });
    expect(() => engine.loadCargo(ship.id, 'lumber', 1)).toThrow();
    expect(() => engine.unloadCargo(ship.id, 'lumber', 1)).toThrow();
    engine.dockShip(engine.currentPlayer.fleet[0].id);
    expect(() => engine.dockShip(engine.currentPlayer.fleet[0].id)).toThrow();
    engine.boardShip(ship.id);
    expect(engine.currentPlayer.fleet).toContain(ship);
    expect(events).toContain('shipTransferred');
    expect(events).toContain('cargoMoved');
    expect(() => engine.boardShip(ship.id)).toThrow();
    expect(() => engine.dockShip(-1)).toThrow();
  });

  it('moves goods both ways, checking combined capacity and stock without partial mutation', () => {
    const { engine, stock, ship } = visit();
    expect(ship.cargo).toEqual({});
    expect(() => engine.loadCargo(ship.id, 'iron', 1)).toThrow();
    stock.lumber = 100;
    stock.specialties.Wine = 10;
    engine.loadCargo(ship.id, 'Wine', 10);
    engine.loadCargo(ship.id, 'lumber', 15);
    expect(cargoLoad(ship)).toBe(ship.cargoCapacity);
    expect(() => engine.loadCargo(ship.id, 'lumber', 1)).toThrow();
    expect(stock.lumber).toBe(85);
    engine.unloadCargo(ship.id, 'Wine', 10);
    expect(stock.specialties.Wine).toBe(10);
    expect(() => engine.unloadCargo(ship.id, 'Wine', 1)).toThrow();
    for (const qty of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => engine.loadCargo(ship.id, 'lumber', qty)).toThrow();
      expect(() => engine.unloadCargo(ship.id, 'lumber', qty)).toThrow();
    }
    expect(() => engine.loadCargo(ship.id, 'bogus' as Good, 1)).toThrow();
    expect(() => engine.loadCargo(-1, 'lumber', 1)).toThrow();
  });

  it('AUTO fills fleet capacity in order with specialties only, including empty and full cases', () => {
    const { engine, stock, ship } = visit();
    expect(engine.autoLoad()).toBe(0);
    stock.lumber = 100;
    stock.iron = 100;
    stock.specialties = { Wine: 200, Sugar: 20 };
    const capacity = engine.currentPlayer.fleet.reduce((n, s) => n + s.cargoCapacity, 0);
    expect(engine.autoLoad()).toBe(capacity);
    expect(ship.cargo.Wine).toBe(ship.cargoCapacity);
    expect(stock.lumber).toBe(100);
    expect(stock.iron).toBe(100);
    expect(stock.specialties.Wine).toBe(200 - capacity);
    expect(engine.autoLoad()).toBe(0);
    engine.unloadCargo(ship.id, 'Wine', ship.cargoCapacity);
    stock.specialties = { Sugar: 2 };
    expect(engine.autoLoad()).toBe(2);
    expect(ship.cargo.Sugar).toBe(2);
  });

  it('guards every method by phase, island kind and ownership', () => {
    const { engine, state, node, ship } = visit();
    const actions = [() => engine.dockShip(ship.id), () => engine.boardShip(ship.id),
      () => engine.loadCargo(ship.id, 'iron', 1), () => engine.unloadCargo(ship.id, 'iron', 1), () => engine.autoLoad()];
    state.phase = 'awaitingSpin';
    for (const action of actions) expect(action).toThrow();
    state.phase = 'awaitingBuild';
    for (const owner of [null, 1]) {
      state.owners[node.id] = owner;
      for (const action of actions) expect(action).toThrow();
    }
    engine.currentPlayer.position = 0;
    state.owners[0] = 0;
    for (const action of actions) expect(action).toThrow();
  });

  it('loses docked ships when their colony falls neutral through bankruptcy', () => {
    const { engine, state, node, ship } = visit();
    engine.dockShip(ship.id);
    const rival = state.map.find((n) => n.kind === 'island' && n.id !== node.id)!;
    state.owners[rival.id] = 1;
    engine.currentPlayer.gold = 0;
    engine.currentPlayer.position = rival.id;
    state.phase = 'moving';
    engine.resolveLanding();
    expect(state.players[0].bankrupt).toBe(true);
    expect(state.owners[node.id]).toBeNull();
    expect(state.docks[node.id]).toEqual([]);
  });
});
