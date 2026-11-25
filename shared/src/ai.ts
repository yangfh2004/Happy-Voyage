import { COMPASS_SECTORS } from './compass';
import { walkPath } from './graph';
import { colonyDefenders, defaultBattleDeployment, forecastColonyBattle, forecastNavalBattle, tollDue } from './combat';
import { GOOD_VALUES, fleetQuantity } from './barter';
import { BUILDINGS, COLONY_PAYBACK_ROUNDS, buildingLevel, colonyCanRepair, colonyToll, nextBuildingCost } from './buildings';
import { isEliminated, turnOrderPosition, REPAIR_GOLD_PER_POINT } from './rules';
import { SEA_RULES } from './seaRules';
import { LOTTERY } from './lottery';
import { RANKS, foreignTaxDue, playerMerit } from './ranks';
import { GOODS, MAX_FLEET_SIZE, SHIP_RECIPES, USED_SHIP_PRICES, cargoLoad, shipSalePrice } from './ships';
import { normalMarketSale, quoteMarketTrade } from './market';
import { hermitStoneTake, NIM_MAX_TAKE, type HermitId } from './mist';
import { STRATEGY_RULES, defectionCount, type StrategyId } from './strategies';
import { roundsLeft as roundsToPlay } from './modes';
import { GameView } from './gameView';
import type { BarterOffer, BuildingKind, GameState, MapNode, MarketOrder, Player, ShipType } from './types';
import { playerRetreatThreshold } from './withdrawal';

const POLICIES = {
  easy:   { reserve: 450, fleetSize: 6, development: 1 },
  normal: { reserve: 400, fleetSize: 7, development: 2 },
  hard:   { reserve: 400, fleetSize: 8, development: 3 },
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
    if (state.roamers.some((r) => r.node === node.id) && !player.escortProtection) return -180;
    if (node.event === 'openSea') return -20;
    if (node.kind === 'island') {
      const owner = state.owners[node.id];
      if (owner === null) {
        if (canWin) return 10_000;
        // Easy takes the first opportunity; stronger rivals compare local traffic.
        return (wyvern ? 150 : 0) + (easy ? 300 : 360 + Math.min(250, estimatedTolls(state, player, node)) * 0.5);
      }
    }
    if (node.id === player.knownHoard) return 425;
    if (!wyvern) return 0;
    if (node.event === 'treasure') return 125;
    if (node.event === 'tradeWind') return 50 + 30 * owned;
    if (node.special === 'nightless' && cargoUnits(player) >= 8) return cargoUnits(player) * 12;
    if (node.special === 'revival') {
      const damage = player.fleet.reduce((sum, ship) => sum + ship.maxDurability - ship.durability, 0);
      return Math.min(damage, Math.floor(Math.max(0, player.gold) / REPAIR_GOLD_PER_POINT));
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
  const salary = state.config.homeSalary + RANKS[player.rank].salary;
  const merit = playerMerit(state, player.id);
  const nextRank = RANKS[player.rank + 1];
  const audience = nextRank && merit >= nextRank.merit ? nextRank.purse : (merit - player.audienceMerit) * 2;
  const repair = player.fleet.reduce((sum, ship) => sum + ship.maxDurability - ship.durability, 0);
  const rivalHoldings = state.players.map((rival) => colonies(state, rival));
  const soleRival = state.players.filter((rival) => !isEliminated(rival) && rival.id !== player.id).length === 1;

  // Use gold-equivalent scores for immediate results and the next compass spin.
  const landing = (node: MapNode, cash: number, direct: boolean): number => {
    if (state.roamers.some((r) => r.node === node.id) && !player.escortProtection) return -180;
    if (node.event === 'openSea') return -20;
    if (node.kind === 'island') {
      const owner = state.owners[node.id];
      const arrival = { ...player, position: node.id, gold: cash };
      if (owner === null) {
        if (canWin) return 10_000;
        return 390 + Math.min(150, estimatedTolls(state, player, node)) * 0.35;
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
    if (node.event === 'storm') return player.escortProtection ? 0 : -100;
    if (node.special === 'mist') return SEA_RULES.nimPrize + 150;
    if (node.special === 'skeleton' && direct && aiUsedShipChoice(state, { ...player, gold: cash }, () => true) === 'warship') {
      const warships = player.fleet.filter((ship) => ship.type === 'warship' && ship.durability >= ship.maxDurability / 2);
      return warships.length < 2 && cash >= 900 ? 540 : 90;
    }
    if (node.special === 'nightless') return cargoUnits(player) * 10;
    if (node.special === 'revival') return Math.min(repair, Math.floor(Math.max(0, cash) / REPAIR_GOLD_PER_POINT));
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
    const repairFee = node.special === 'revival'
      ? Math.min(repair, Math.floor(Math.max(0, cash) / REPAIR_GOLD_PER_POINT)) * REPAIR_GOLD_PER_POINT
      : 0;
    const score = pay + landing(node, cash, true) +
      (roundsLeft(state) > 0 ? 0.55 * spinValue(node.id, cash - repairFee) : 0);
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

function estimatedTolls(state: GameState, player: Player, node: MapNode): number {
  const myTurn = turnOrderPosition(state, player.id);
  let tolls = 0;
  for (const rival of state.players) {
    if (isEliminated(rival) || rival.id === player.id) continue;
    const moves = roundsLeft(state) + Number(turnOrderPosition(state, rival.id) > myTurn);
    if (moves === 0) continue;
    const nextSpinOdds = COMPASS_SECTORS.reduce((chance, { steps, odds }) =>
      chance + (walkPath(state.map, rival.position, steps, state.wind.direction).at(-1) === node.id ? odds : 0), 0);
    tolls += Math.min(rival.gold, node.toll ?? 0) * (nextSpinOdds + (moves - 1) / state.map.length);
  }
  return tolls;
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
  const canMake = (type: ShipType) => stock.lumber >= SHIP_RECIPES[type].lumber && stock.iron >= SHIP_RECIPES[type].iron;
  const yardLevel = level('shipyard');
  const warshipYardLevel = SHIP_RECIPES.warship.yardLevel;
  if (newShip && development >= warshipYardLevel && yardLevel > 0 && yardLevel < warshipYardLevel &&
      aiShipChoice(player, canMake) === 'warship') {
    const upgradeCost = BUILDINGS.shipyard.costs.slice(yardLevel, warshipYardLevel)
      .reduce((total, cost) => total + cost, 0);
    if (funding >= upgradeCost) return 'shipyard';
  }
  const value = (kind: BuildingKind): number => {
    switch (kind) {
      case 'collectionField': return node.specialty ? Math.min(20, turns) * (level(kind) === 0 ? 6 : 2) : 0;
      case 'lumberMill': return needsMaterials && level(kind) === 0 && stock.lumber < SHIP_RECIPES.explorer.lumber ? 100 : 0;
      case 'ironMine': return needsMaterials && level(kind) === 0 && stock.iron < SHIP_RECIPES.explorer.iron ? 100 : 0;
      case 'shipyard': {
        const next = yardLevel + 1;
        if (!newShip || next > development) return 0;
        if (next === 1) return supplies('lumberMill', 'lumber') && supplies('ironMine', 'iron') ? 130 : 0;
        return next === 2 && !player.fleet.some((ship) => ship.type === 'cargo') && canMake('cargo') ? 120 : 0;
      }
      case 'repairYard':
        return colonyCanRepair(state, node.id) ? 0
          : state.docks[node.id].reduce((sum, ship) => sum + ship.maxDurability - ship.durability, 0) * REPAIR_GOLD_PER_POINT;
    }
  };
  let best: BuildingKind | null = null;
  let bestReturn = 0;
  for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) {
    const cost = nextBuildingCost(state, node.id, kind);
    if (cost === null || cost > funding) continue;
    const starterIndustry = level(kind) === 0 && turns + 1 >= COLONY_PAYBACK_ROUNDS &&
      (kind === 'lumberMill' || kind === 'ironMine' || (kind === 'collectionField' && node.specialty));
    const purpose = Math.max(value(kind), starterIndustry ? cost / COLONY_PAYBACK_ROUNDS + 1 : 0);
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
  const defectors = card === 'betray' ? [...ships].sort((a, b) => a.firepower - b.firepower).slice(0, defectionCount(ships.length, fromFleet)) : [];
  const availableSlots = Math.max(0, MAX_FLEET_SIZE - player.fleet.length);
  const attackers = defaultBattleDeployment([...player.fleet, ...defectors.slice(0, availableSlots)]);
  const remaining = card === 'betray' ? ships.filter((s) => !defectors.includes(s)) : ships;
  const defenders = defaultBattleDeployment(card === 'betray'
    ? (!fromFleet && !remaining.length ? owner.fleet : remaining)
    : card === 'mislead'
      ? ships.map((s, i) => i === 0 ? { ...s, durability: Math.min(s.durability, Math.max(1, s.durability - STRATEGY_RULES.misleadDamage)) } : s)
      : ships);
  const options = { attackerThreshold: playerRetreatThreshold(player), defenderThreshold: playerRetreatThreshold(owner), attackerMultiplier: state.inspired || card === 'inspire' ? STRATEGY_RULES.inspireMultiplier : 1, skipFirstDefense: state.ambush || card === 'ambush' };
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
  if (canUse('exemption') && ((mustFight && forecastColonyBattle(state, player) !== 'victory') ||
    (!aiShouldFight(state, player) && tollDue(state, player, player.position) >= (player.aiDifficulty === 'easy' ? 200 : 80)))) return 'exemption';
  if (baseline >= 4 && player.aiDifficulty !== 'hard') return undefined;
  const cards: StrategyId[] = player.aiDifficulty === 'easy' ? ['inspire', 'ambush', 'betray', 'mislead'] : ['betray', 'ambush', 'mislead', 'inspire'];
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
    const weakest = [...ships].sort((a, b) => a.firepower - b.firepower)[0];
    if (weakest && canUse('betray') && (player.fleet.length < policy(player).fleetSize || weakest.type === 'warship') &&
      weakest.durability >= weakest.maxDurability / 2 && battleQuality(state, player, 'betray') >= baseline) return 'betray';
    const lead = ships[0];
    if (lead?.type === 'warship' && lead.durability > 1 && baseline < 4 && canUse('mislead') && fromFleet &&
      (state.players.filter((rival) => !isEliminated(rival)).length === 2 || colonies(state, owner) >= colonies(state, player))) return 'mislead';
  }
  return best;
}

export function aiSeaStrategy(state: GameState, player: Player, canUse: (card: StrategyId, target?: number) => boolean): { card: StrategyId; target?: number } | undefined {
  if (player.aiDifficulty === 'easy' && (state.round + player.id) % 3 !== 0) return undefined;
  const view = new GameView(state);
  const worth = (p: Player) => view.netWorth(p.id);
  const rivals = state.players.filter((p) => p.id !== player.id && !isEliminated(p)).sort((a, b) => worth(b) - worth(a));
  const leader = rivals[0];
  const owned = colonies(state, player);
  const candidates: { card: StrategyId; target?: number; useful: boolean }[] = [
    { card: 'repair', useful: player.fleet.some((s) => s.durability < s.maxDurability * 0.6) },
    { card: 'charter', useful: owned >= 2 },
    { card: 'harvest', useful: owned >= 2 },
    { card: 'escort', useful: !player.escortProtection },
    { card: 'recall', useful: player.position !== player.homePort && player.fleet.some((s) => s.durability < s.maxDurability * 0.4) },
  ];
  if (leader) {
    for (const card of ['betray', 'mislead', 'plunder', 'blockade', 'gale', 'exchange'] as const) {
      const useful = card === 'betray' ? leader.fleet.length >= 3 : card === 'mislead' ? leader.fleet.some((s) => s.durability > 1) : card === 'plunder' ? leader.gold >= 300 : card === 'blockade' ? !leader.skipNextTurn : card === 'gale' ? leader.fleet.some((s) => s.durability > STRATEGY_RULES.galeDamage) : owned < colonies(state, leader);
      candidates.push({ card, target: leader.id, useful });
    }
  }
  const targets = state.map.filter((n) => rivals.some((p) => p.id === state.owners[n.id])).sort((a, b) => worth(state.players[state.owners[b.id]!]) - worth(state.players[state.owners[a.id]!]));
  for (const node of targets) {
    candidates.push({ card: 'revolt', target: node.id, useful: !state.docks[node.id].length && !Object.values(state.buildings[node.id] ?? {}).some((level) => level > 0) });
    const stock = state.stockpiles[node.id];
    candidates.push({ card: 'scorch', target: node.id, useful: stock.lumber + stock.iron + Object.values(stock.specialties).reduce((a, b) => a + (b ?? 0), 0) >= 5 });
  }
  const movementValue = (multiplier: number, position = player.position) => COMPASS_SECTORS.reduce((sum, { steps, odds }) => {
    const path = walkPath(state.map, position, steps * multiplier, state.wind.direction);
    const node = state.map[path.at(-1)!];
    const owner = state.owners[node.id];
    const salary = path.filter((id) => id === player.homePort).length * state.config.homeSalary;
    const landsOnRoamer = state.roamers.some((r) => r.node === node.id);
    const escortAtDestination = player.escortProtection && !landsOnRoamer;
    const value = node.kind === 'island' ? owner === null ? 180 : owner !== player.id ? -tollDue(state, player, node.id) : 20
      : node.event === 'storm' && !escortAtDestination ? -100 : node.event === 'openSea' ? -20 : 0;
    const hazard = !player.escortProtection && landsOnRoamer ? 180 : 0;
    return sum + odds * (salary + value - hazard);
  }, 0);
  const baseline = player.aiDifficulty === 'hard' ? movementValue(1) : 0;
  for (const card of ['tailwind', 'reverse'] as const) candidates.push({ card, useful: player.aiDifficulty !== 'hard' || movementValue(card === 'tailwind' ? 2 : -1) > baseline + 25 });
  candidates.push({ card: 'inspire', useful: player.aiDifficulty !== 'hard' && player.fleet.some((s) => s.durability < s.maxDurability) });
  if (player.aiDifficulty === 'hard') {
    const target = canUse('navigate', player.position) ? aiTravelTarget(state, player) : undefined;
    candidates.push({ card: 'navigate', target, useful: target !== undefined });
    const exchange = candidates.find((c) => c.card === 'exchange');
    if (exchange && leader) exchange.useful = movementValue(1, leader.position) > baseline + 80;
    const priorities: StrategyId[] = ['betray', 'revolt', 'repair', 'charter', 'plunder', 'navigate', 'blockade', 'escort', 'harvest', 'mislead', 'gale', 'scorch', 'recall', 'exchange', 'tailwind', 'reverse', 'inspire'];
    candidates.sort((a, b) => priorities.indexOf(a.card) - priorities.indexOf(b.card));
  }
  return candidates.find(({ card, target, useful }) => useful && canUse(card, target));
}

/** Fight if conquest is likely, or if paying the toll is not an option. */
export function aiShouldFight(state: GameState, player: Player): boolean {
  if (!player.fleet.length) return false;
  const nodeId = player.position;
  if (player.gold < tollDue(state, player, nodeId)) return true;
  return battleQuality(state, player) >= 4;
}
