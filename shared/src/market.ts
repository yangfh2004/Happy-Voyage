import { cargoLoad, GOODS } from './ships';
import { isEliminated } from './rules';
import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { GameState, Good, MarketOrder, MarketState } from './types';

const rules = GAMEPLAY_TUNING.market;

export function createMarket(): MarketState {
  const stock = Object.fromEntries(GOODS.map((good) => [good, rules.normalStock])) as MarketState['stock'];
  return { stock, repairDemandThroughRound: 0 };
}

export function advanceMarket(market: MarketState): void {
  for (const good of GOODS) {
    const gap = rules.normalStock - market.stock[good];
    market.stock[good] += Math.sign(gap) * Math.min(Math.abs(gap), rules.recoveryPerRound);
  }
}

export function marketDemand(state: GameState) {
  return {
    featuredGood: GOODS[(state.round + 1) % GOODS.length],
    stormRepairs: state.round <= state.market.repairDemandThroughRound,
  };
}

function unitValue(state: GameState, good: Good, stock: number): number {
  const { featuredGood, stormRepairs } = marketDemand(state);
  const demand = (good === featuredGood ? rules.featuredDemand : 0) +
    (stormRepairs && (good === 'lumber' || good === 'iron') ? rules.repairDemand : 0);
  return inventoryValue(good, stock) + demand;
}

function inventoryValue(good: Good, stock: number): number {
  const base = rules.basePrice[good];
  return base + Math.max(-Math.floor(base * rules.discountCapRate), Math.min(Math.floor(base * rules.premiumCapRate), rules.normalStock - stock));
}

/** Sale estimate after stock returns to normal, ignoring temporary demand bonuses. */
export function normalMarketSale(good: Good, quantity: number): number {
  let total = 0;
  for (let i = 1; i <= quantity; i++) total += inventoryValue(good, rules.normalStock + i);
  return total;
}

function spread(good: Good): number {
  return Math.ceil(rules.basePrice[good] * rules.buySpreadRate);
}

export function marketPrices(state: GameState, good: Good) {
  const stock = state.market.stock[good];
  return { stock, buy: unitValue(state, good, stock) + spread(good), sell: unitValue(state, good, stock + 1) };
}

/** Total at current prices, or null if the full order cannot be filled. */
export function quoteMarketTrade(state: GameState, order: MarketOrder): number | null {
  const { side, shipId, good, quantity } = order;
  if (state.phase !== 'awaitingCargoMarket' || !GOODS.includes(good) ||
    (side !== 'buy' && side !== 'sell') || !Number.isSafeInteger(quantity) || quantity < 1) return null;
  const player = state.players[state.currentPlayer];
  const node = state.map[player.position];
  const ship = player.fleet.find((candidate) => candidate.id === shipId);
  if (node?.kind !== 'special' || node.special !== 'nightless' || isEliminated(player) || !ship) return null;

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
