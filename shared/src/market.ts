import { cargoLoad, GOODS } from './ships';
import { isEliminated } from './rules';
import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { GameState, Good, MarketOrder, MarketState } from './types';

const rules = GAMEPLAY_TUNING.market;
const colonyRules = GAMEPLAY_TUNING.colonyMarket;

export function colonyMarket(state: GameState) {
  const player = state.players[state.currentPlayer];
  const node = state.map[player.position];
  const owner = state.owners[player.position];
  if (node?.kind !== 'island' || owner == null || isEliminated(player) ||
    state.phase !== (owner === player.id ? 'awaitingBuild' : 'awaitingToll')) return null;
  return {
    node,
    owner,
    stock: state.colonyMarketStock[node.id],
    taxRate: owner === player.id ? 0 : colonyRules.visitorTaxRate,
  };
}

export function colonySpecialtyPrice(local: Good | undefined, good: Good, side: MarketOrder['side']): number {
  const base = rules.basePrice[good];
  return side === 'sell' && good !== local ? Math.round(base * (1 + colonyRules.foreignSpecialtyPremium)) : base;
}

export function colonyTradeTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate);
}

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

export function nightlessSaleTotal(state: GameState, good: Good, quantity: number): number {
  const stock = state.market.stock[good];
  let total = 0;
  for (let i = 1; i <= quantity; i++) total += unitValue(state, good, stock + i);
  return total;
}

/** Total at current prices, or null if the full order cannot be filled. */
export function quoteMarketTrade(state: GameState, order: MarketOrder): number | null {
  return marketTradeQuote(state, order)?.total ?? null;
}

export function marketTradeQuote(state: GameState, order: MarketOrder): { total: number; tax: number } | null {
  const { side, shipId, good, quantity } = order;
  if (!GOODS.includes(good) ||
    (side !== 'buy' && side !== 'sell') || !Number.isSafeInteger(quantity) || quantity < 1) return null;
  const player = state.players[state.currentPlayer];
  const node = state.map[player.position];
  const ship = player.fleet.find((candidate) => candidate.id === shipId);
  if (isEliminated(player) || !ship) return null;
  const buying = side === 'buy';
  if (buying ? quantity > ship.cargoCapacity - cargoLoad(ship) : quantity > (ship.cargo[good] ?? 0)) return null;

  const local = colonyMarket(state);
  if (local) {
    if (good === 'lumber' || good === 'iron' || (buying && (good !== node.specialty || quantity > local.stock))) return null;
    const subtotal = quantity * colonySpecialtyPrice(node.specialty, good, side);
    const tax = colonyTradeTax(subtotal, local.taxRate);
    const total = buying ? subtotal + tax : subtotal - tax;
    return buying && total > player.gold ? null : { total, tax };
  }

  if (state.phase !== 'awaitingCargoMarket' || node?.kind !== 'special' || node.special !== 'nightless') return null;
  const stock = state.market.stock[good];
  if (buying && quantity > stock) return null;
  if (!buying) return { total: nightlessSaleTotal(state, good, quantity), tax: 0 };
  let total = 0;
  // Price each unit at its inventory level so splitting an order can't improve its price.
  for (let i = 0; i < quantity; i++) {
    total += unitValue(state, good, stock - i) + spread(good);
  }
  return total > player.gold ? null : { total, tax: 0 };
}
