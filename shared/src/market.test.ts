import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { colonyMarket, marketDemand, marketPrices, marketTradeQuote, quoteMarketTrade } from './market';
import { tollDue } from './combat';
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

describe('colony local market', () => {
  const colonyMap: MapNode[] = [
    ...map,
    { id: 5, name: 'Tea Colony', kind: 'island', specialty: 'Tea', price: 100, x: 5, y: 0 },
    { id: 6, name: 'Neutral Island', kind: 'island', price: 100, x: 6, y: 0 },
  ];

  function atColony(owner: number, visitor = 0) {
    const g = new GameEngine({ players, map: [...colonyMap], rng: () => 0.99, config: { islandsToWin: 3 } });
    g.state.owners[1] = owner;
    g.state.owners[5] = 0;
    g.state.currentPlayer = visitor;
    land(g, 1);
    const ship = g.currentPlayer.fleet[0];
    const buy = { side: 'buy', good: 'Wine', shipId: ship.id, quantity: 3 } as const;
    const sell = { side: 'sell', good: 'Tea', shipId: ship.id, quantity: 2 } as const;
    ship.cargo.Tea = 2;
    return { g, ship, buy, sell };
  }

  it('trades tax-free for the island owner without touching production or Nightless stock', () => {
    const { g, ship, buy, sell } = atColony(0);
    g.state.stockpiles[1].specialties.Wine = 4;
    const nightless = structuredClone(g.state.market);
    const gold = g.currentPlayer.gold;
    expect(marketTradeQuote(g.state, buy)).toEqual({ total: 54, tax: 0 });
    expect(marketTradeQuote(g.state, sell)).toEqual({ total: 58, tax: 0 });
    g.tradeAtMarket(buy);
    g.tradeAtMarket(sell);
    expect(g.currentPlayer.gold).toBe(gold + 4);
    expect(ship.cargo).toEqual({ Wine: 3 });
    expect(colonyMarket(g.state)?.stock).toBe(13);
    expect(g.state.colonyMarketStock[5]).toBe(16);
    expect(g.state.stockpiles[1].specialties).toEqual({ Wine: 4 });
    expect(g.state.market).toEqual(nightless);
    expect(g.state.phase).toBe('awaitingBuild');
    g.finishBuilding();
    land(g, 0);
    expect(g.state.colonyMarketStock[1]).toBe(16);
    expect(quoteMarketTrade(g.state, buy)).toBeNull();
  });

  it('adds a visitor’s tax to purchases, deducts it from sales and pays it to the island owner', () => {
    const { g, buy, sell } = atColony(1);
    const [visitor, owner] = g.state.players;
    const visitorGold = visitor.gold;
    const ownerGold = owner.gold;
    const toll = tollDue(g.state, visitor, 1);
    expect(marketTradeQuote(g.state, buy)).toEqual({ total: 59, tax: 5 });
    expect(marketTradeQuote(g.state, sell)).toEqual({ total: 52, tax: 6 });
    g.tradeAtMarket(buy);
    g.tradeAtMarket(sell);
    expect(visitor.gold).toBe(visitorGold - 7);
    expect(owner.gold).toBe(ownerGold + 11);
    expect(g.state.phase).toBe('awaitingToll');
    g.payToll();
    expect(visitor.gold).toBe(visitorGold - 7 - toll);
    expect(owner.gold).toBe(ownerGold + 11 + toll);
    expect(g.state.currentPlayer).toBe(owner.id);
  });

  it('rejects invalid goods, depleted local stock, and orders unaffordable after tax without mutations', () => {
    const { g, ship, buy, sell } = atColony(1);
    g.state.colonyMarketStock[1] = 3;
    g.state.stockpiles[1].specialties.Wine = 20;
    g.currentPlayer.gold = 54;
    ship.cargo.iron = 1;
    const before = structuredClone(g.state);
    for (const order of [buy, { ...buy, quantity: 4 }, { ...buy, good: 'Tea', quantity: 1 },
      { ...sell, good: 'iron', quantity: 1 }] as MarketOrder[]) {
      expect(quoteMarketTrade(g.state, order)).toBeNull();
      expect(() => g.tradeAtMarket(order)).toThrow('Cannot fill market order');
    }
    expect(g.state).toEqual(before);
    g.currentPlayer.gold = 100;
    g.tradeAtMarket(buy);
    expect(quoteMarketTrade(g.state, { ...buy, quantity: 1 })).toBeNull();
  });

  it('lets an AI visitor sell specialties, buy stock for resale, and continue its turn', () => {
    const { g, ship } = atColony(0, 1);
    g.state.players[0].position = 0;
    for (const ship of g.currentPlayer.fleet) ship.durability = 20;
    g.decideForAI();
    expect(ship.cargo.Tea).toBeUndefined();
    expect(ship.cargo.Wine).toBe(16);
    expect(g.state.phase).toBe('awaitingSpin');
    expect(g.state.currentPlayer).toBe(0);
  });

  it('lets an AI short on gold sell cargo before deciding whether it needs to attack', () => {
    const { g, ship } = atColony(0, 1);
    g.state.map[1] = { ...g.state.map[1], toll: 50 };
    g.state.players[0].position = 0;
    g.currentPlayer.strategies = [];
    g.currentPlayer.gold = 10;
    for (const ship of g.currentPlayer.fleet) ship.durability = 20;
    const visitor = g.currentPlayer;
    g.decideForAI();
    expect(ship.cargo.Tea).toBeUndefined();
    expect(visitor.gold).toBe(12);
    expect(g.state.battles).toHaveLength(0);
    expect(g.state.currentPlayer).toBe(0);
  });

  it('sells but does not buy speculation cargo on the AI’s last round', () => {
    const { g, ship } = atColony(0, 1);
    g.state.config.maxRounds = g.state.round;
    g.state.players[0].position = 0;
    g.currentPlayer.strategies = [];
    for (const ship of g.currentPlayer.fleet) ship.durability = 20;
    const netWorthBefore = g.netWorth(g.currentPlayer.id);
    g.decideForAI();
    expect(ship.cargo.Tea).toBeUndefined();
    expect(ship.cargo.Wine).toBeUndefined();
    expect(g.netWorth(1)).toBe(netWorthBefore + 52);
    expect(g.state.victory).toBe('richest');
  });

  it('holds Silver bought at a colony rather than liquidating it below cost at Nightless Island', () => {
    const { g, ship } = atColony(0, 1);
    g.state.map[1] = { ...g.state.map[1], specialty: 'Silver' };
    g.state.players[0].position = 0;
    const ai = g.currentPlayer;
    ai.strategies = [];
    for (const ship of ai.fleet) ship.durability = 20;
    const purchase = marketTradeQuote(g.state, { side: 'buy', good: 'Silver', shipId: ship.id, quantity: 16 })!;
    g.decideForAI();
    expect(ship.cargo.Silver).toBe(16);

    land(g, 0);
    land(g, 3);
    ship.cargo.Silver! += 1;
    const before = ai.gold;
    const sale = { side: 'sell', good: 'Silver', shipId: ship.id, quantity: 16 } as const;
    expect(quoteMarketTrade(g.state, sale)).toBeLessThan(purchase.total);
    const untrackedProceeds = quoteMarketTrade(g.state, { ...sale, quantity: 1 })!;
    g.decideForAI();
    expect(ship.cargo.Silver).toBe(16);
    expect(ai.gold).toBe(before + untrackedProceeds);
  });
});
