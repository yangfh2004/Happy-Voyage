import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { shipSalePrice, USED_SHIP_PRICES } from './ships';
import type { ShipType } from './types';

function visit() {
  const engine = new GameEngine({ players: [{ name: 'Trader', color: 0, isAI: false }] });
  engine.currentPlayer.position = engine.state.map.find((node) => node.special === 'skeleton')!.id;
  engine.state.phase = 'moving';
  engine.resolveLanding();
  return engine;
}

describe('Skeleton Island market', () => {
  it.each(['explorer', 'cargo', 'warship'] as ShipType[])('buys worn %s and sells it at a loss', (type) => {
    const engine = visit();
    const player = engine.currentPlayer;
    const gold = player.gold;
    const ship = engine.buyUsedShip(type);
    expect(ship.durability).toBe(ship.maxDurability * 0.6);
    expect(ship.cargo).toEqual({});
    expect(player.gold).toBe(gold - USED_SHIP_PRICES[type]);
    expect(engine.canBuyUsedShip(type)).toBe(false);
    expect(() => engine.buyUsedShip(type)).toThrow();
    const price = shipSalePrice(ship);
    engine.sellShip(ship.id);
    expect(player.fleet).not.toContain(ship);
    expect(player.gold).toBe(gold - USED_SHIP_PRICES[type] + price);
    expect(price).toBeLessThan(USED_SHIP_PRICES[type]);
    engine.finishMarket();
    expect(engine.state.phase).toBe('awaitingSpin');
    expect(engine.state.marketStock).toEqual([]);
  });

  it('rejects wrong phase, location, gold, type, ownership, cargo and last ship without mutations', () => {
    const engine = visit();
    const player = engine.currentPlayer;
    const ship = player.fleet[0];
    const refuse = (action: () => void) => {
      const before = structuredClone(engine.state);
      expect(action).toThrow();
      expect(engine.state).toEqual(before);
    };
    player.gold = 179;
    refuse(() => engine.buyUsedShip('explorer'));
    player.gold = 180;
    refuse(() => engine.buyUsedShip('constructor' as ShipType));
    refuse(() => engine.sellShip(999));
    ship.cargo = { Wine: 1 };
    refuse(() => engine.sellShip(ship.id));
    ship.cargo = {};
    engine.state.phase = 'awaitingSpin';
    refuse(() => engine.buyUsedShip('explorer'));
    refuse(() => engine.sellShip(ship.id));
    engine.state.phase = 'awaitingMarket';
    const position = player.position;
    player.position = player.homePort;
    refuse(() => engine.buyUsedShip('explorer'));
    refuse(() => engine.sellShip(ship.id));
    player.position = position;
    player.fleet = [ship];
    refuse(() => engine.sellShip(ship.id));
    const bought = engine.buyUsedShip('explorer');
    expect(player.gold).toBe(0);
    expect(bought.id).not.toBe(ship.id);
  });

  it('prices damage and empty stock, refreshes on revisits, and lets AI leave', () => {
    const engine = visit();
    const ship = engine.currentPlayer.fleet[0];
    const full = shipSalePrice(ship);
    ship.durability /= 2;
    expect(shipSalePrice(ship)).toBe(Math.floor(full / 2));
    ship.durability = 0;
    expect(shipSalePrice(ship)).toBe(0);
    for (const type of [...engine.state.marketStock]) engine.buyUsedShip(type);
    expect(engine.state.marketStock).toEqual([]);
    expect(engine.canBuyUsedShip('cargo')).toBe(false);
    engine.decideForAI();
    expect(engine.state.phase).toBe('awaitingSpin');
    engine.state.phase = 'moving';
    engine.resolveLanding();
    expect(engine.state.marketStock).toHaveLength(3);
  });
});

describe('Colony ship trading and free Skeleton Island visits', () => {
  it.each([0, 34, 35, 1000])('never charges tribute or pays for scrap with %ig', (gold) => {
    const engine = visit();
    engine.currentPlayer.gold = gold;
    engine.state.phase = 'moving';
    engine.resolveLanding();
    expect(engine.currentPlayer.gold).toBe(gold);
    expect(engine.state.phase).toBe('awaitingMarket');
    expect(engine.state.log.join(' ')).not.toMatch(/tribute|scrap/);
  });

  function colony() {
    const engine = new GameEngine({ players: [{ name: 'Trader', color: 0, isAI: true }, { name: 'Rival', color: 1, isAI: true }] });
    const player = engine.currentPlayer;
    const node = engine.state.map.find((node) => node.kind === 'island')!;
    engine.state.owners[node.id] = player.id;
    player.position = node.id;
    engine.state.phase = 'moving';
    engine.resolveLanding();
    return engine;
  }

  it('buys and sells at an owned colony without a shipyard, with limited stock', () => {
    const engine = colony();
    expect(engine.state.phase).toBe('awaitingBuild');
    const player = engine.currentPlayer;
    const gold = player.gold;
    const ship = engine.buyUsedShip('cargo');
    expect(ship).toMatchObject({ type: 'cargo', durability: 60, cargo: {} });
    expect(player.gold).toBe(gold - USED_SHIP_PRICES.cargo);
    expect(engine.canBuyUsedShip('cargo')).toBe(false);
    engine.sellShip(ship.id);
    expect(player.gold).toBe(gold - USED_SHIP_PRICES.cargo + shipSalePrice(ship));
    expect(engine.state.phase).toBe('awaitingBuild');
    engine.finishBuilding();
    expect(engine.canBuyUsedShip('explorer')).toBe(false);
  });

  it('rejects rival colonies, loaded ships, missing gold and repeat purchases atomically', () => {
    const engine = colony();
    const player = engine.currentPlayer;
    const refuse = (action: () => void) => {
      const before = structuredClone(engine.state);
      expect(action).toThrow();
      expect(engine.state).toEqual(before);
    };
    player.gold = 0;
    refuse(() => engine.buyUsedShip('explorer'));
    player.gold = 1000;
    player.fleet[0].cargo = { Wine: 1 };
    refuse(() => engine.sellShip(player.fleet[0].id));
    engine.state.owners[player.position] = 1;
    refuse(() => engine.buyUsedShip('cargo'));
    refuse(() => engine.sellShip(player.fleet[1].id));
    engine.state.owners[player.position] = player.id;
    engine.buyUsedShip('explorer');
    refuse(() => engine.buyUsedShip('explorer'));
  });

  it('lets AI manage trading and finish its colony turn', () => {
    const engine = colony();
    engine.currentPlayer.gold = 3000;
    engine.decideForAI();
    expect(engine.state.phase).toBe('awaitingSpin');
    expect(engine.state.currentPlayer).toBe(1);
  });

  it('keeps the last sailing ship when selling at a colony, avoiding fleet-loss defeat', () => {
    const engine = colony();
    const player = engine.currentPlayer;
    expect(player.fleet).toHaveLength(5);
    for (const ship of [...player.fleet].slice(1)) engine.sellShip(ship.id);
    expect(player.fleet).toHaveLength(1);
    const before = structuredClone(engine.state);
    expect(engine.canSellShip(player.fleet[0].id)).toBe(false);
    expect(() => engine.sellShip(player.fleet[0].id)).toThrow();
    expect(engine.state).toEqual(before);
    engine.finishBuilding();
    expect(player.fleetLost).not.toBe(true);
  });

  it.each(['colony', 'skeleton'] as const)('does not let eliminated players trade at %s', (location) => {
    const engine = location === 'colony' ? colony() : visit();
    const player = engine.currentPlayer;
    player.fleetLost = true;
    const before = structuredClone(engine.state);
    expect(engine.canBuyUsedShip('explorer')).toBe(false);
    expect(engine.canSellShip(player.fleet[0].id)).toBe(false);
    expect(() => engine.buyUsedShip('explorer')).toThrow();
    expect(() => engine.sellShip(player.fleet[0].id)).toThrow();
    expect(engine.state).toEqual(before);
  });
});
