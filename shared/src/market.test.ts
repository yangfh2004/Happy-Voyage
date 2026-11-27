import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { marketDemand, marketPrices, quoteMarketTrade } from './market';
import type { MapNode, MarketOrder } from './types';

const players = [0, 1].map((i) => ({ name: `Captain ${i}`, color: i, isAI: i === 1 }));
const map: MapNode[] = [
  { id: 0, name: 'Home', kind: 'port', x: 0, y: 0 },
  { id: 1, name: 'Wine Colony', kind: 'island', specialty: 'Wine', price: 100, x: 1, y: 0 },
  { id: 2, name: 'Storm', kind: 'event', event: 'storm', x: 2, y: 0 },
  { id: 3, name: 'Nightless Island', kind: 'special', special: 'nightless', x: 3, y: 0 },
  { id: 4, name: 'Trade Winds', kind: 'event', event: 'tradeWind', x: 4, y: 0 },
];

function roll(g: GameEngine, steps = 5) {
  g.state.phase = 'spinning';
  g.state.lastSpin = steps;
  g.sail();
  g.resolveLanding();
}

function land(g: GameEngine, nodeId: number) {
  g.currentPlayer.position = nodeId;
  g.state.phase = 'moving';
  g.resolveLanding();
}

function atMarket() {
  const g = new GameEngine({ players, map });
  land(g, 3);
  const ship = g.currentPlayer.fleet[0];
  return { g, ship, order: { good: 'Wine', shipId: ship.id, quantity: 3, side: 'buy' } as const };
}

describe('Nightless Island market', () => {
  it('opens at all three chart locations with shared stock', () => {
    const g = new GameEngine({ players: [...players, { name: 'Captain 2', color: 2, isAI: false }], rng: () => 0.99 });
    const markets = g.state.map.filter((node) => node.special === 'nightless');
    expect(markets).toHaveLength(3);
    const initialStock = marketPrices(g.state, 'Wine').stock;
    for (const [i, market] of markets.entries()) {
      land(g, market.id);
      expect(g.state.phase).toBe('awaitingCargoMarket');
      expect(marketPrices(g.state, 'Wine').stock).toBe(initialStock - i);
      const ship = g.currentPlayer.fleet[0];
      g.tradeAtMarket({ side: 'buy', good: 'Wine', shipId: ship.id, quantity: 1 });
      expect(ship.cargo.Wine).toBe(1);
      expect(g.state.log.at(-1)).toContain(`at ${market.name}.`);
      g.finishTrading();
    }
  });

  it('takes a voyage from founding a colony to selling its own production', () => {
    const g = new GameEngine({ players: [players[0]], map, config: { startingStrategies: 0 }, rng: () => 0.99 });
    g.state.roamers = [];
    g.state.config.islandsToWin = 2; // Owning the map's only island would otherwise win at once.
    g.start();
    roll(g, 6); // Six stops: land on the colony.
    roll(g); // Five stops: return to build a collection field.
    g.build('collectionField');
    g.finishBuilding();
    roll(g); // Return after a round of production.
    const ship = g.currentPlayer.fleet.find(({ type }) => type === 'cargo')!;
    g.loadCargo(ship.id, 'Wine', 1);
    g.finishBuilding();
    roll(g, 2); // Two stops: dock at the market.
    const gold = g.currentPlayer.gold;
    const stock = marketPrices(g.state, 'Wine').stock;
    const order = { good: 'Wine', shipId: ship.id, quantity: 1, side: 'sell' } as const;
    const proceeds = marketPrices(g.state, 'Wine').sell;
    g.tradeAtMarket(order);
    expect(g.currentPlayer.gold).toBe(gold + proceeds);
    expect(ship.cargo.Wine).toBeUndefined();
    expect(g.state.stockpiles[1].specialties.Wine).toBe(1);
    expect(marketPrices(g.state, 'Wine').stock).toBe(stock + 1);
    g.finishTrading();
    expect(g.state.phase).toBe('awaitingSpin');
  });

  it('only trades carried goods and fills an order atomically at the quoted price', () => {
    const { g, ship, order } = atMarket();
    const gold = g.currentPlayer.gold;
    const before = marketPrices(g.state, 'Wine');
    const total = quoteMarketTrade(g.state, order)!;
    expect(total).toBeGreaterThan(before.buy * order.quantity);
    g.tradeAtMarket(order);
    expect(g.currentPlayer.gold).toBe(gold - total);
    expect(ship.cargo.Wine).toBe(3);
    expect(marketPrices(g.state, 'Wine')).toMatchObject({ stock: before.stock - 3, buy: before.buy + 3 });

    const sell = { ...order, side: 'sell' } as const;
    const revenue = quoteMarketTrade(g.state, sell)!;
    g.tradeAtMarket(sell);
    expect(revenue).toBeLessThan(total);
    expect(ship.cargo.Wine).toBeUndefined();
    expect(g.currentPlayer.gold).toBe(gold - total + revenue);
    expect(marketPrices(g.state, 'Wine')).toEqual(before);
    expect(g.state.phase).toBe('awaitingCargoMarket');
    g.finishTrading();
    expect(g.currentPlayer.id).toBe(1);
    expect(g.state.phase).toBe('awaitingSpin');
  });

  it('rejects invalid quantities, unavailable stock, capacity, gold and non-fleet cargo without mutations', () => {
    const { g, ship, order } = atMarket();
    const otherShip = g.state.players[1].fleet[0];
    otherShip.cargo.Wine = 3;
    const dockedShip = g.currentPlayer.fleet.pop()!;
    dockedShip.cargo.Wine = 3;
    g.state.docks[1].push(dockedShip);
    ship.cargo.lumber = ship.cargoCapacity - 2;
    g.currentPlayer.gold = 0;
    const rejected: MarketOrder[] = [
      { ...order, quantity: 1 },
      { ...order, quantity: 3 },
      { ...order, quantity: 99 },
      { ...order, quantity: -1 },
      { ...order, quantity: 1.5 },
      { ...order, quantity: Infinity },
      { ...order, side: 'sell', shipId: otherShip.id },
      { ...order, side: 'sell', shipId: dockedShip.id },
      { ...order, side: 'sell' },
      { ...order, good: '__proto__' as MarketOrder['good'] },
      { ...order, side: 'other' as MarketOrder['side'] },
    ];
    const before = structuredClone(g.state);
    for (const invalid of rejected) {
      expect(quoteMarketTrade(g.state, invalid)).toBeNull();
      expect(() => g.tradeAtMarket(invalid)).toThrow('Cannot fill market order');
      expect(g.state).toEqual(before);
    }
    g.currentPlayer.gold = 1000;
    expect(quoteMarketTrade(g.state, { ...order, shipId: g.currentPlayer.fleet[1].id, quantity: 17 })).toBeNull();
    g.finishTrading();
    expect(quoteMarketTrade(g.state, { ...order, shipId: otherShip.id })).toBeNull();
  });

  it('rebalances supply between rounds and responds to weather and shifting demand across seats', () => {
    const { g, order } = atMarket();
    const featured = marketDemand(g.state).featuredGood;
    const price = marketPrices(g.state, featured).buy;
    g.tradeAtMarket(order);
    g.finishTrading();
    land(g, 0);
    expect(g.state.round).toBe(2);
    expect(marketPrices(g.state, 'Wine')).toMatchObject({ stock: 15 });
    expect(marketDemand(g.state).featuredGood).not.toBe(featured);

    const lumber = marketPrices(g.state, 'lumber');
    land(g, 2);
    expect(marketPrices(g.state, 'lumber').buy).toBe(lumber.buy + 4);
    g.skipSalvage();
    land(g, 4);
    if (g.state.phase === 'awaitingSalvage') g.skipSalvage();
    expect(g.state.round).toBe(3);
    expect(marketPrices(g.state, 'lumber')).toMatchObject({ stock: lumber.stock + 1, buy: lumber.buy + 3 });
    expect(marketPrices(g.state, featured).buy).toBeLessThan(price);
    land(g, 0);
    land(g, 0);
    expect(marketDemand(g.state).stormRepairs).toBe(false);
    expect(marketPrices(g.state, 'lumber')).toEqual(lumber);
  });

  it('lets the AI sell carried cargo and continue the game', () => {
    const { g } = atMarket();
    g.finishTrading();
    const ai = g.currentPlayer;
    ai.fleet[0].cargo.Wine = 3;
    const gold = ai.gold;
    land(g, 3);
    g.decideForAI();
    expect(ai.gold).toBeGreaterThan(gold);
    expect(ai.fleet[0].cargo.Wine).toBeUndefined();
    expect(g.state.round).toBe(2);
    expect(g.state.phase).toBe('awaitingSpin');
    expect(g.currentPlayer.id).toBe(0);
    land(g, 0);
    expect(g.currentPlayer.id).toBe(1);
  });
});
