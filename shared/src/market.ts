import { cargoLoad, GOODS } from './ships';
import type { GameState, Good, MarketOrder, MarketState } from './types';

const BASE_PRICE: Record<Good, number> = {
  lumber: 10, iron: 14, Wine: 18, Sugar: 13, Cotton: 12, Timber: 15, Cocoa: 16,
  Tobacco: 17, Silver: 24, Spices: 22, Silk: 21, Tea: 19,
};
const NORMAL_STOCK = 16;

export function createMarket(): MarketState {
  const stock = Object.fromEntries(GOODS.map((good) => [good, NORMAL_STOCK])) as MarketState['stock'];
  return { stock, repairDemandThroughRound: 0 };
}

export function advanceMarket(market: MarketState): void {
  for (const good of GOODS) {
    const gap = NORMAL_STOCK - market.stock[good];
    market.stock[good] += Math.sign(gap) * Math.min(Math.abs(gap), 2);
  }
}

export function marketDemand(state: GameState) {
  return {
    featuredGood: GOODS[(state.round + 1) % GOODS.length],
    stormRepairs: state.round <= state.market.repairDemandThroughRound,
  };
}

function unitValue(state: GameState, good: Good, stock: number): number {
  const base = BASE_PRICE[good];
  const { featuredGood, stormRepairs } = marketDemand(state);
  const demand = (good === featuredGood ? 3 : 0) +
    (stormRepairs && (good === 'lumber' || good === 'iron') ? 4 : 0);
  const scarcity = Math.max(-Math.floor(base / 2), Math.min(base, NORMAL_STOCK - stock));
  return base + scarcity + demand;
}

function spread(good: Good): number {
  return Math.ceil(BASE_PRICE[good] / 4);
}

export function marketPrices(state: GameState, good: Good) {
  const stock = state.market.stock[good];
  return { stock, buy: unitValue(state, good, stock) + spread(good), sell: unitValue(state, good, stock + 1) };
}

/** Total at current prices, or null if the full order cannot be filled. */
export function quoteMarketTrade(state: GameState, order: MarketOrder): number | null {
  const { side, shipId, good, quantity } = order;
  if (state.phase !== 'awaitingMarket' || !GOODS.includes(good) ||
    (side !== 'buy' && side !== 'sell') || !Number.isSafeInteger(quantity) || quantity < 1) return null;
  const player = state.players[state.currentPlayer];
  const node = state.map[player.position];
  const ship = player.fleet.find((candidate) => candidate.id === shipId);
  if (node?.kind !== 'special' || node.special !== 'nightless' || player.bankrupt || !ship) return null;

  const stock = state.market.stock[good];
  const buying = side === 'buy';
  if (buying ? quantity > stock || quantity > ship.cargoCapacity - cargoLoad(ship) : quantity > (ship.cargo[good] ?? 0)) return null;
  let total = 0;
  // Price each unit at its inventory level so splitting an order can't improve its price.
  for (let i = 0; i < quantity; i++) {
    total += buying ? unitValue(state, good, stock - i) + spread(good) : unitValue(state, good, stock + i + 1);
  }
  return buying && total > player.gold ? null : total;
}
