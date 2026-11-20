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
