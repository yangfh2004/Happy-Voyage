import { COMPASS_SECTORS } from './compass';
import { forecastColonyBattle, tollDue } from './combat';
import { GOOD_VALUES, fleetQuantity } from './barter';
import { captainBonus, discountedByCaptains } from './captains';
import type { BarterOffer } from './types';
import { BUILDINGS, colonyToll, nextBuildingCost } from './buildings';
import type { BuildingKind } from './types';
import { colonyValue, turnOrderPosition, REPAIR_GOLD_PER_POINT } from './rules';
import { SEA_RULES } from './seaRules';
import { LOTTERY, expectedLotteryPrize } from './lottery';
import { RANKS, foreignTaxDue } from './ranks';
import { shipSalePrice } from './ships';
import { roundsLeft } from './modes';
import type { GameState, MapNode, Player, Ship } from './types';

/** Gold an AI keeps back before buying lottery numbers. */
export const AI_LOTTERY_RESERVE = 600;

/** How many Treasure Island numbers the AI buys: up to three, never dipping below its reserve. */
export function aiLotteryPickCount(gold: number): number {
  return Math.max(0, Math.min(3, Math.floor((gold - AI_LOTTERY_RESERVE) / LOTTERY.ticketPrice)));
}

export function aiBarterChoice(player: Player, offers: BarterOffer[]): number | null {
  let best: number | null = null;
  let profit = 0;
  offers.forEach((offer, index) => {
    const gain = offer.receiveQty * GOOD_VALUES[offer.receive] - offer.giveQty * GOOD_VALUES[offer.give];
    if (fleetQuantity(player, offer.give) >= offer.giveQty && gain > profit) {
      best = index;
      profit = gain;
    }
  });
  return best;
}

export function aiWyvernTarget(state: GameState, player: Player): number {
  const score = (node: MapNode): number => {
    if (node.kind === 'island' && state.owners[node.id] === null && player.gold >= (node.price ?? Infinity))
      return aiShouldClaim(state, { ...player, position: node.id }, node.id) ? 1000 - (node.price ?? 0) : 0;
    if (node.special === 'revival') return 150;
    if (node.event === 'treasure') return 125;
    if (node.event === 'tradeWind') return 100;
    if (node.id === player.homePort) return 50;
    return -100;
  };
  return [...state.map].sort((a, b) => score(b) - score(a) || a.id - b.id)[0].id;
}

/** Forecast the next two moves without knowing the compass results. */
function bankruptcyOdds(state: GameState, player: Player, gold: number, coloniesAfterClaim: number): number {
  const { map, owners, config } = state;
  const horizon = Math.min(2, roundsLeft(config, state.round));
  const tradeIncome = 50 + 30 * coloniesAfterClaim;
  function forecast(position: number, cash: number, turns: number, protectedFromHazards: boolean, fleet: Ship[]): number {
    if (cash < 0) return 1;
    if (turns === 0) return 0;
    return COMPASS_SECTORS.reduce((risk, { steps, odds }) => {
      const distance = position + steps;
      const next = distance % map.length;
      const node = map[next];
      const passes = Array.from({ length: steps }, (_, i) => (position + i + 1) % map.length).filter((id) => id === player.homePort).length;
      const afterSalary = cash + passes * (config.homeSalary + RANKS[player.rank].salary + captainBonus(player, 'salary'));
      const owner = owners[next];
      const hazard = ['storm', 'pirates', 'smallMonster', 'largeMonster', 'turtle', 'whirlpool'].includes(node.event ?? '');
      const onward = (balance: number, protection = protectedFromHazards, ships = fleet) => forecast(next, balance, turns - 1, protection, ships);
      if (hazard && protectedFromHazards) return risk + odds * onward(afterSalary, false);
      if (node.kind === 'port' && node.id !== player.homePort) {
        const balance = afterSalary - discountedByCaptains(player, 'tax', foreignTaxDue(player.rank));
        let shortfall = Math.max(0, -balance);
        const remaining = [...fleet].sort((a, b) => shipSalePrice(a) - shipSalePrice(b) || a.id - b.id);
        while (shortfall > 0 && remaining.length > 0) shortfall -= shipSalePrice(remaining.shift()!);
        return risk + odds * (shortfall > 0 || remaining.length === 0 ? 1 : onward(Math.max(0, balance), protectedFromHazards, remaining));
      }
      if (node.event === 'pirates' || node.event === 'smallMonster' || node.event === 'largeMonster') return risk + odds * onward(afterSalary - SEA_RULES[node.event]);
      if (node.event === 'whirlpool') return risk + odds * (SEA_RULES.whirlpoolDamageChance * onward(afterSalary - SEA_RULES.whirlpoolLoss) + (1 - SEA_RULES.whirlpoolDamageChance) * onward(afterSalary));
      if (node.special === 'skeleton') return risk + odds * onward(afterSalary >= SEA_RULES.tribute ? afterSalary - SEA_RULES.tribute : afterSalary + SEA_RULES.scrap);
      if (node.special === 'treasure' && aiLotteryPickCount(afterSalary) > 0) {
        const picks = aiLotteryPickCount(afterSalary);
        const balance = afterSalary - picks * LOTTERY.ticketPrice;
        return risk + odds * onward(balance + Math.round(expectedLotteryPrize(picks)));
      }
      if (node.special === 'revival') {
        const damage = fleet.reduce((sum, ship) => sum + ship.maxDurability - ship.durability, 0);
        const fee = Math.min(damage, Math.floor(Math.max(0, afterSalary) / REPAIR_GOLD_PER_POINT)) * REPAIR_GOLD_PER_POINT;
        return risk + odds * onward(afterSalary - fee, true);
      }
      if (node.event === 'storm') {
        const stormRisk = [50, 75, 100].reduce(
          (sum, repair) => sum + onward(afterSalary - repair),
          0,
        );
        return risk + odds * stormRisk / 3;
      }
      if (turns > 1 && node.event === 'treasure') {
        const treasureRisk = [50, 100, 150, 200].reduce(
          (sum, payout) => sum + onward(afterSalary + payout),
          0,
        );
        return risk + odds * treasureRisk / 4;
      }
      if (turns > 1 && node.event === 'tradeWind') {
        return risk + odds * onward(afterSalary + tradeIncome);
      }
      const paysToll = node.kind === 'island' && owner !== null && owner !== player.id;
      const toll = paysToll ? colonyToll(state, node.id) : 0;
      return risk + odds * onward(afterSalary - discountedByCaptains(player, 'toll', toll));
    }, 0);
  }
  return forecast(player.position, gold, horizon, player.revivalProtection, player.fleet);
}

function estimatedTolls(state: GameState, player: Player, node: MapNode): number {
  const myTurn = turnOrderPosition(state, player.id);
  let tolls = 0;
  for (const rival of state.players) {
    if (rival.bankrupt || rival.id === player.id) continue;
    const moves = roundsLeft(state.config, state.round) + Number(turnOrderPosition(state, rival.id) > myTurn);
    if (moves === 0) continue;
    const nextSpinOdds = COMPASS_SECTORS.reduce((chance, { steps, odds }) =>
      chance + ((rival.position + steps) % state.map.length === node.id ? odds : 0), 0);
    tolls += Math.min(rival.gold, node.toll ?? 0) * (nextSpinOdds + (moves - 1) / state.map.length);
  }
  return tolls;
}

export function aiShouldClaim(state: GameState, player: Player, nodeId: number): boolean {
  const node = state.map[nodeId];
  const price = node.price ?? Infinity;
  if (player.gold < price) return false;

  const owned = state.owners.filter((owner) => owner === player.id).length;
  const leftToWin = state.config.islandsToWin - owned;
  if (leftToWin <= 1) return true;

  const turnsLeft = roundsLeft(state.config, state.round);
  const cash = player.gold - price;
  if (bankruptcyOdds(state, player, cash, owned + 1) > 0.12) return false;
  const neutralIslands = state.map.filter((stop) => stop.kind === 'island' && state.owners[stop.id] === null).length;
  if (turnsLeft + 1 >= leftToWin && neutralIslands >= leftToWin) return true;
  return estimatedTolls(state, player, node) >= price - colonyValue(node);
}

export function aiBuildingChoice(state: GameState, player: Player): BuildingKind | null {
  if (state.phase !== 'awaitingBuild' || state.owners[player.position] !== player.id) return null;
  const reserve = Math.max(400, state.config.homeSalary);
  return (Object.keys(BUILDINGS) as BuildingKind[])
    .filter((kind) => {
      const cost = nextBuildingCost(state, player.position, kind);
      return cost !== null && player.gold - cost >= reserve;
    })
    .sort((a, b) => nextBuildingCost(state, player.position, a)! - nextBuildingCost(state, player.position, b)!)[0] ?? null;
}

/** Fight a rival colony when an average battle wins it, or when the toll would bankrupt the fleet anyway. */
export function aiShouldFight(state: GameState, player: Player): boolean {
  if (!player.fleet.length) return false;
  const nodeId = player.position;
  if (player.gold < tollDue(state, player, nodeId)) return true;
  return forecastColonyBattle(state, player) === 'victory';
}
