import { COMPASS_SECTORS } from './compass';
import { walkPath } from './graph';
import { colonyDefenders, forecastNavalBattle, tollDue } from './combat';
import { GOOD_VALUES, fleetQuantity } from './barter';
import { captainBonus, discountedByCaptains } from './captains';
import { BUILDINGS, buildingLevel, colonyToll, nextBuildingCost } from './buildings';
import { colonyValue, turnOrderPosition, REPAIR_GOLD_PER_POINT } from './rules';
import { SEA_RULES } from './seaRules';
import { LOTTERY, expectedLotteryPrize } from './lottery';
import { RANKS, foreignTaxDue, playerMerit } from './ranks';
import { GOODS, SHIP_RECIPES, USED_SHIP_PRICES, cargoLoad, shipSalePrice } from './ships';
import { normalMarketSale, quoteMarketTrade } from './market';
import { hermitStoneTake, NIM_MAX_TAKE, type HermitId } from './mist';
import { STRATEGY_RULES, type StrategyId } from './strategies';
import { roundsLeft as roundsToPlay } from './modes';
import type { BarterOffer, BuildingKind, GameState, MapNode, MarketOrder, Player, Ship, ShipType } from './types';

const POLICIES = {
  easy:   { claimRisk: 0.08, reserve: 450, fleetSize: 3, development: 1 },
  normal: { claimRisk: 0.12, reserve: 400, fleetSize: 4, development: 2 },
  hard:   { claimRisk: 0.10, reserve: 400, fleetSize: 5, development: 3 },
} as const;

const policy = (player: Player) => POLICIES[player.aiDifficulty ?? 'normal'];
const roundsLeft = (state: GameState) => roundsToPlay(state.config, state.round);
const reserve = (state: GameState, player: Player) => Math.max(policy(player).reserve, state.config.homeSalary);
const colonies = (state: GameState, player: Player) => state.owners.filter((owner) => owner === player.id).length;
const cargoUnits = (player: Player) => player.fleet.reduce((sum, ship) => sum + cargoLoad(ship), 0);
const freeCargo = (player: Player) => player.fleet.reduce((sum, ship) => sum + ship.cargoCapacity - cargoLoad(ship), 0);

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
    if (fleetQuantity(player, offer.give) >= offer.giveQty && freeCargo(player) + offer.giveQty >= offer.receiveQty && gain > profit) {
      best = index;
      profit = gain;
    }
  });
  return best;
}

/** Rank profitable landings, only using information visible to this seat. */
export function aiTravelTarget(state: GameState, player: Player, wyvern = false): number | undefined {
  if (player.aiDifficulty === 'hard') return hardTravelTarget(state, player, wyvern);
  const easy = player.aiDifficulty === 'easy';
  if (!wyvern && player.knownHoard !== null) return player.knownHoard;
  const owned = colonies(state, player);
  const canWin = owned + 1 >= state.config.islandsToWin;
  const score = (node: MapNode): number => {
    if (node.id === player.position) return 0;
    const arrival = { ...player, position: node.id };
    if (node.kind === 'island') {
      const owner = state.owners[node.id];
      if (owner === null && aiShouldClaim(state, arrival, node.id)) {
        if (canWin) return 10_000;
        // Easy takes the first safe opportunity; stronger rivals compare costs and local traffic.
        return (wyvern ? 150 : 0) + (easy ? 300 : 360 - (node.price ?? 0) * 0.25 + Math.min(250, estimatedTolls(state, player, node)) * 0.5);
      }
    }
    if (node.id === player.knownHoard) return 425;
    if (!wyvern) return 0;
    if (node.event === 'treasure') return 125;
    if (node.event === 'tradeWind') return 50 + 30 * owned;
    if (node.special === 'nightless' && cargoUnits(player) >= 8) return cargoUnits(player) * 12;
    if (node.special === 'revival') {
      const damage = player.fleet.reduce((sum, ship) => sum + ship.maxDurability - ship.durability, 0);
      return damage >= 100 && player.gold >= reserve(state, player) + damage * REPAIR_GOLD_PER_POINT ? damage : 0;
    }
    if (wyvern && node.id === player.homePort) return state.config.homeSalary;
    return 0;
  };
  let best: number | undefined;
  let bestScore = 0;
  for (const node of state.map) {
    const value = score(node);
    if (value > bestScore) {
      best = node.id;
      bestScore = value;
    }
  }
  return best ?? (wyvern ? player.homePort : undefined);
}

function hardTravelTarget(state: GameState, player: Player, wyvern: boolean): number | undefined {
  const owned = colonies(state, player);
  const canWin = owned + 1 >= state.config.islandsToWin;
  const salary = state.config.homeSalary + RANKS[player.rank].salary + captainBonus(player, 'salary');
  const merit = playerMerit(state, player.id);
  const nextRank = RANKS[player.rank + 1];
  const audience = nextRank && merit >= nextRank.merit ? nextRank.purse : (merit - player.audienceMerit) * 2;
  const repair = player.fleet.reduce((sum, ship) => sum + ship.maxDurability - ship.durability, 0);
  const rivalHoldings = state.players.map((rival) => colonies(state, rival));
  const soleRival = state.players.filter((rival) => !rival.bankrupt && rival.id !== player.id).length === 1;

  // Use gold-equivalent scores for immediate results and the next compass spin.
  const landing = (node: MapNode, cash: number, direct: boolean): number => {
    if (node.kind === 'island') {
      const owner = state.owners[node.id];
      const arrival = { ...player, position: node.id, gold: cash };
      if (owner === null && aiShouldClaim(state, arrival, node.id)) {
        if (canWin) return 10_000;
        return 390 - (node.price ?? 0) * 0.7 + Math.min(150, estimatedTolls(state, player, node)) * 0.35;
      }
      if (owner !== null && owner !== player.id) {
        const quality = player.fleet.length ? battleQuality(state, arrival) : 0;
        if (quality >= 4 && canWin) return 9_000;
        if (quality === 5) {
          const { fromFleet, ships } = colonyDefenders(state, node.id);
          const disarm = fromFleet && ships.length ? (soleRival ? 460 : 120 + 24 * rivalHoldings[owner]) : 0;
          return 310 + Math.min(130, colonyToll(state, node.id)) + disarm;
        }
        const toll = tollDue(state, player, node.id);
        return -toll - (cash < toll ? 600 : 0);
      }
      if (owner === player.id && direct && roundsLeft(state) >= 4) {
        const stock = state.stockpiles[node.id];
        const specialty = node.specialty ? Math.min(freeCargo(player), stock.specialties[node.specialty] ?? 0) : 0;
        const level = buildingLevel(state, node.id, 'shipyard');
        const launch = aiShipChoice(player, (type) => {
          const recipe = SHIP_RECIPES[type];
          return level >= recipe.yardLevel && stock.lumber >= recipe.lumber && stock.iron >= recipe.iron;
        });
        return specialty * 4 + (launch ? 160 : 0);
      }
    }
    if (node.kind === 'port') return node.id === player.homePort ? Math.max(0, audience) : -foreignTaxDue(player.rank);
    if (node.event === 'treasure') return 125 + (node.id === player.knownHoard ? STRATEGY_RULES.hoardGold : 0);
    if (node.event === 'tradeWind') return 50 + 30 * owned;
    if (node.event === 'bottle') return 100 + Math.min(120, repair);
    if (node.event === 'floatingCargo') return 70;
    if (node.event === 'wyvern') return direct ? -Infinity : 220;
    if (node.event === 'pirates' || node.event === 'smallMonster' || node.event === 'largeMonster') {
      return player.revivalProtection ? 0 : -SEA_RULES[node.event] - 50;
    }
    if (node.event === 'storm' || node.event === 'turtle' || node.event === 'whirlpool') return player.revivalProtection ? 0 : -100;
    if (node.special === 'mist') return SEA_RULES.nimPrize + 150;
    if (node.special === 'skeleton' && direct && aiUsedShipChoice(state, { ...player, gold: cash - SEA_RULES.tribute }, () => true) === 'warship') {
      const warships = player.fleet.filter((ship) => ship.type === 'warship' && ship.durability >= ship.maxDurability / 2);
      return warships.length < 2 && cash >= 900 ? 540 : 90;
    }
    if (node.special === 'nightless') return cargoUnits(player) * 10;
    if (node.special === 'revival') return cash > repair * REPAIR_GOLD_PER_POINT + 150 ? repair + 35 : 0;
    return 0;
  };

  const spinLandings = new Map<number, Map<number, number>>();
  const spinValue = (position: number, cash: number) => {
    return COMPASS_SECTORS.reduce((value, { steps, odds }) => {
      const path = walkPath(state.map, position, steps, state.wind.direction);
      const pay = path.filter((id) => id === player.homePort).length * salary;
      const next = state.map[path.at(-1)!];
      const arrivalCash = cash + pay;
      let scores = spinLandings.get(arrivalCash);
      if (!scores) spinLandings.set(arrivalCash, scores = new Map());
      let score = scores.get(next.id);
      if (score === undefined) scores.set(next.id, score = landing(next, arrivalCash, false));
      return value + odds * (pay + Math.min(400, score));
    }, 0);
  };

  let best = wyvern ? player.homePort : undefined;
  let bestScore = wyvern ? -Infinity : spinValue(player.position, player.gold) + 110;
  for (const node of state.map) {
    if (node.id === player.position) continue;
    const pay = wyvern && node.id === player.homePort ? salary : 0;
    const cash = player.gold + pay;
    const score = pay + landing(node, cash, true) +
      (roundsLeft(state) > 0 ? 0.55 * spinValue(node.id, cash) : 0);
    if (score > bestScore) {
      best = node.id;
      bestScore = score;
    }
  }
  return best;
}

export function aiMistTake(hermit: HermitId, stones: number): number {
  // Search the known hermit replies for a line that leaves it the last stone.
  for (let take = 1; take <= Math.min(NIM_MAX_TAKE, stones - 1); take++) {
    const remainder = stones - take;
    const next = remainder - hermitStoneTake(hermit, remainder);
    if (next === 0 || (next > 1 && aiMistTake(hermit, next) !== 0)) return take;
  }
  return 0;
}

export function aiWyvernTarget(state: GameState, player: Player): number {
  return aiTravelTarget(state, player, true)!;
}

/** Forecast the next two moves without knowing the compass results. */
function bankruptcyOdds(state: GameState, player: Player, gold: number, coloniesAfterClaim: number): number {
  const { map, owners, config } = state;
  const horizon = Math.min(2, roundsLeft(state));
  const tradeIncome = 50 + 30 * coloniesAfterClaim;
  function forecast(position: number, cash: number, turns: number, protectedFromHazards: boolean, fleet: Ship[]): number {
    if (cash < 0) return 1;
    if (turns === 0) return 0;
    return COMPASS_SECTORS.reduce((risk, { steps, odds }) => {
      const path = walkPath(map, position, steps, state.wind.direction);
      const next = path.at(-1)!;
      const node = map[next];
      const passes = path.filter((id) => id === player.homePort).length;
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
    const moves = roundsLeft(state) + Number(turnOrderPosition(state, rival.id) > myTurn);
    if (moves === 0) continue;
    const nextSpinOdds = COMPASS_SECTORS.reduce((chance, { steps, odds }) =>
      chance + (walkPath(state.map, rival.position, steps, state.wind.direction).at(-1) === node.id ? odds : 0), 0);
    tolls += Math.min(rival.gold, node.toll ?? 0) * (nextSpinOdds + (moves - 1) / state.map.length);
  }
  return tolls;
}

export function aiShouldClaim(state: GameState, player: Player, nodeId: number): boolean {
  const node = state.map[nodeId];
  const price = node.price ?? Infinity;
  if (player.gold < price) return false;

  const owned = colonies(state, player);
  const leftToWin = state.config.islandsToWin - owned;
  if (leftToWin <= 1) return true;

  const turnsLeft = roundsLeft(state);
  const cash = player.gold - price;
  if (bankruptcyOdds(state, player, cash, owned + 1) > policy(player).claimRisk) return false;
  const neutralIslands = state.map.filter((stop) => stop.kind === 'island' && state.owners[stop.id] === null).length;
  if (turnsLeft + 1 >= leftToWin && (neutralIslands >= leftToWin || player.aiDifficulty === 'hard')) return true;
  return estimatedTolls(state, player, node) >= price - colonyValue(node);
}

export function aiBuildingChoice(state: GameState, player: Player): BuildingKind | null {
  const node = state.map[player.position];
  if (state.phase !== 'awaitingBuild' || state.owners[node.id] !== player.id) return null;
  const turns = roundsLeft(state);
  const level = (kind: BuildingKind) => buildingLevel(state, node.id, kind);
  const { development, fleetSize } = policy(player);
  const stock = state.stockpiles[node.id];
  const funding = player.gold - reserve(state, player) - (player.aiDifficulty === 'hard' ? 250 : 0);
  const tollReturn = estimatedTolls(state, player, node) * 0.25;
  const newShip = player.fleet.length < fleetSize && turns >= 8;
  const supplies = (kind: 'lumberMill' | 'ironMine', good: 'lumber' | 'iron') =>
    level(kind) > 0 || stock[good] >= SHIP_RECIPES.explorer[good];
  const remainingSetupCost = (supplies('lumberMill', 'lumber') ? 0 : BUILDINGS.lumberMill.costs[0]) +
    (supplies('ironMine', 'iron') ? 0 : BUILDINGS.ironMine.costs[0]) +
    (level('shipyard') > 0 ? 0 : BUILDINGS.shipyard.costs[0]);
  const needsMaterials = newShip && development > 1 && funding >= remainingSetupCost;
  const value = (kind: BuildingKind): number => {
    switch (kind) {
      case 'collectionField': return node.specialty ? Math.min(20, turns) * (level(kind) === 0 ? 6 : 2) : 0;
      case 'lumberMill': return needsMaterials && level(kind) === 0 && stock.lumber < SHIP_RECIPES.explorer.lumber ? 100 : 0;
      case 'ironMine': return needsMaterials && level(kind) === 0 && stock.iron < SHIP_RECIPES.explorer.iron ? 100 : 0;
      case 'shipyard': {
        const next = level(kind) + 1;
        if (!newShip || next > development) return 0;
        if (next === 1) return supplies('lumberMill', 'lumber') && supplies('ironMine', 'iron') ? 130 : 0;
        const canMake = (type: ShipType) => stock.lumber >= SHIP_RECIPES[type].lumber && stock.iron >= SHIP_RECIPES[type].iron;
        if (development === 3 && canMake('warship') && funding >= (next === 2 ? 1000 : 600)) return 175;
        return next === 2 && !player.fleet.some((ship) => ship.type === 'cargo') && canMake('cargo') ? 120 : 0;
      }
      case 'repairYard':
        return state.docks[node.id].reduce((sum, ship) => sum + ship.maxDurability - ship.durability, 0) * REPAIR_GOLD_PER_POINT;
    }
  };
  let best: BuildingKind | null = null;
  let bestReturn = 0;
  for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) {
    const cost = nextBuildingCost(state, node.id, kind);
    if (cost === null || cost > funding) continue;
    const purpose = value(kind);
    if (purpose <= 0 || (kind === 'collectionField' && level(kind) >= development)) continue;
    const benefit = purpose + (development === 1 ? 0 : tollReturn) - cost * 0.25;
    if (benefit > bestReturn) {
      best = kind;
      bestReturn = benefit;
    }
  }
  return best;
}

export function aiShipChoice(player: Player, legal: (type: ShipType) => boolean): ShipType | undefined {
  const { fleetSize } = policy(player);
  if (player.fleet.length >= fleetSize) return undefined;
  const hasCargo = player.fleet.some((ship) => ship.type === 'cargo');
  const hasWarship = player.fleet.some((ship) => ship.type === 'warship');
  const order: ShipType[] = !hasWarship ? ['warship', 'explorer', 'cargo']
    : !hasCargo ? ['cargo', 'explorer', 'warship'] : ['warship', 'explorer', 'cargo'];
  return order.find(legal);
}

export function aiUsedShipChoice(state: GameState, player: Player, legal: (type: ShipType) => boolean): ShipType | undefined {
  const spendingLimit = player.gold - reserve(state, player);
  const replaceLosses = player.fleet.length < 3;
  if (!replaceLosses && (player.aiDifficulty !== 'hard' || roundsLeft(state) < 8)) return undefined;
  return aiShipChoice(player, (type) => legal(type) && USED_SHIP_PRICES[type] <= spendingLimit &&
    // Don't spend the same gold replacing a healthy fleet with a marginal improvement.
    (replaceLosses || type === 'warship'));
}

export function aiUsedShipSale(state: GameState, player: Player, legal: (id: number) => boolean): number | undefined {
  const needsCash = player.gold < reserve(state, player);
  if (!needsCash || player.fleet.length < 3) return undefined;
  return player.fleet.filter((ship) => legal(ship.id) && !ship.signature && ship.type === 'explorer' && shipSalePrice(ship) > 0)
    .sort((a, b) => b.durability - a.durability)[0]?.id;
}

/** Only buy discounted specialties that can repay the spread after stock recovers. */
export function aiMarketPurchase(state: GameState, player: Player): MarketOrder | undefined {
  if (player.aiDifficulty !== 'hard' || roundsLeft(state) < 8) return undefined;
  const ship = [...player.fleet].sort((a, b) => b.cargoCapacity - cargoLoad(b) - (a.cargoCapacity - cargoLoad(a)))[0];
  if (!ship) return undefined;
  let best: MarketOrder | undefined;
  let profit = 0;
  for (const good of GOODS) {
    if (good === 'lumber' || good === 'iron') continue;
    for (let quantity = 1; quantity <= 6; quantity++) {
      const order: MarketOrder = { side: 'buy', shipId: ship.id, good, quantity };
      const cost = quoteMarketTrade(state, order);
      const gain = normalMarketSale(good, quantity) - (cost ?? Infinity) - 2 * quantity;
      if (cost !== null && cost <= player.gold - reserve(state, player) && gain > profit) {
        best = order;
        profit = gain;
      }
    }
  }
  return best;
}

function battleQuality(state: GameState, player: Player, card?: StrategyId): number {
  const { ships, owner, fromFleet } = colonyDefenders(state, player.position);
  const attackers = card === 'betray' ? [...player.fleet, ships[0]] : player.fleet;
  const removesDefender = card === 'mislead' || card === 'betray';
  const defenders = !removesDefender ? ships : !fromFleet && ships.length === 1 ? owner.fleet : ships.slice(1);
  const options = { attackerMultiplier: state.inspired || card === 'inspire' ? STRATEGY_RULES.inspireMultiplier : 1 };
  const baseline = forecastNavalBattle(attackers, defenders, options);
  if (player.aiDifficulty !== 'hard') return baseline === 'victory' ? 4 : baseline === 'draw' ? 2 : 0;
  // Stress-test with weaker attack and stronger defense rolls, without drawing from the match RNG.
  const adverse = forecastNavalBattle(attackers, defenders, { ...options, attackerRoll: 0.35, defenderRoll: 0.65 });
  return (baseline === 'victory' ? 3 : baseline === 'draw' ? 1 : 0) +
    (adverse === 'victory' ? 2 : adverse === 'draw' ? 1 : 0);
}

export function aiBattleStrategy(state: GameState, player: Player, canUse: (card: StrategyId) => boolean): StrategyId | undefined {
  const mustFight = player.gold < tollDue(state, player, player.position);
  const baseline = battleQuality(state, player);
  if (baseline >= 4 && player.aiDifficulty !== 'hard') return undefined;
  const cards: StrategyId[] = player.aiDifficulty === 'easy' ? ['inspire'] : ['betray', 'mislead', 'inspire'];
  let best: StrategyId | undefined;
  let bestQuality = baseline;
  for (const card of cards) {
    if (!canUse(card)) continue;
    const quality = battleQuality(state, player, card);
    if ((quality > bestQuality && (quality >= 4 || mustFight)) || (mustFight && !best && card === 'betray' && quality === bestQuality)) {
      best = card;
      bestQuality = quality;
    }
  }
  if (!best && player.aiDifficulty === 'hard') {
    // Weakening a major rival's fleet can pay off even if we pay the toll now.
    const { ships, owner, fromFleet } = colonyDefenders(state, player.position);
    const lead = ships[0];
    if (lead && canUse('betray') && (player.fleet.length < policy(player).fleetSize || lead.type === 'warship') &&
      lead.durability >= lead.maxDurability / 2 && battleQuality(state, player, 'betray') >= baseline) return 'betray';
    if (lead?.type === 'warship' && baseline < 4 && canUse('mislead') && fromFleet &&
      (state.players.filter((rival) => !rival.bankrupt).length === 2 || colonies(state, owner) >= colonies(state, player))) return 'mislead';
  }
  return best;
}

/** Fight if conquest is likely, or if paying the toll is not an option. */
export function aiShouldFight(state: GameState, player: Player): boolean {
  if (!player.fleet.length) return false;
  const nodeId = player.position;
  if (player.gold < tollDue(state, player, nodeId)) return true;
  return battleQuality(state, player) >= 4;
}
