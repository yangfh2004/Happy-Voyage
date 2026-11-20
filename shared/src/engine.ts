import { aiShouldClaim, aiBuildingChoice, aiBarterChoice, aiShouldFight, aiWyvernTarget } from './ai';
import { COMBAT, colonyDefenders, fightNavalBattle, tollDue } from './combat';
import { barterOffers, fleetQuantity, GOOD_VALUES } from './barter';
import { BUILDINGS, buildingLevel, nextBuildingCost, buildingValue, colonyProduction } from './buildings';
import type { BuildingKind } from './types';
import { SEA_RULES } from './seaRules';
import { seaEventText } from './seaEvents';
import { RANKS, playerMerit, foreignTaxDue } from './ranks';
export { SEA_RULES } from './seaRules';
import { spinCompass, type Rng } from './compass';
import { createDefaultMap } from './map';
import { advanceMarket, createMarket, quoteMarketTrade } from './market';
import { colonyValue, seatAtTurnOrderPosition, turnOrderPosition, REPAIR_GOLD_PER_POINT, SEA_HAZARD_DAMAGE } from './rules';
import { SHIP_RECIPES, SHIP_TYPES, STARTING_FLEET, GOODS, cargoLoad, USED_SHIP_PRICES, USED_SHIP_CONDITION, shipSalePrice } from './ships';
import type { Good, SeaEventResult, Specialty } from './types';
import { navigatorById, type SignatureShip } from './navigators';
import type { BattleReport, ColonyStockpile, GameConfig, GameEvent, GameState, MapNode, MarketOrder, Player, PlayerSetup, Ship, ShipStats, ShipType } from './types';

export const DEFAULT_CONFIG: GameConfig = {
  startingGold: 1400,
  homeSalary: 400,
  islandsToWin: 10,
  maxRounds: 50,
};

export const EVENT_GOLD = {
  treasure: { min: 50, max: 200, step: 50 },
  storm: { min: 50, max: 100, step: 25 },
  tradeWind: { base: 50, perColony: 30 },
} as const;


export interface EngineOptions {
  players: PlayerSetup[];
  config?: Partial<GameConfig>;
  map?: MapNode[];
  rng?: Rng;
}

type Listener = (event: GameEvent, state: GameState) => void;

function emptyStockpile(): ColonyStockpile {
  return { lumber: 0, iron: 0, specialties: {} };
}

/**
 * The rules of the core loop, independent of any renderer:
 *
 *   awaitingSpin --spinCompass()--> spinning --sail()--> moving --resolveLanding()-->
 *   awaitingClaim --claim()/decline()--> (next player) awaitingSpin ... until gameOver
 *   (a rival colony instead waits in awaitingToll for payToll() / fight())
 *
 * Renderers can animate the compass and path before the next action.
 * The same class can run on the server for multiplayer.
 */
export class GameEngine {
  readonly state: GameState;
  private readonly rng: Rng;
  private readonly listeners = new Set<Listener>();
  private relocations = 0;
  /** Stops sailed by the current roll, settled in resolveLanding(). */
  private pendingPath: number[] = [];

  constructor(options: EngineOptions) {
    if (options.players.length < 1) throw new Error('At least one player is required');
    const config = { ...DEFAULT_CONFIG, ...options.config };
    const map = options.map ?? createDefaultMap();
    const ports = map.filter((node) => node.kind === 'port');
    const usedPorts = new Set<number>();
    const homes = options.players.map((player) => {
      const port = ports.find((node) => node.nation === player.nation && player.nation && !usedPorts.has(node.id));
      if (port) usedPorts.add(port.id);
      return port?.id;
    });
    options.players.forEach((_, seat) => {
      if (homes[seat] !== undefined) return;
      const preferred = ports[seat];
      const port = preferred && !usedPorts.has(preferred.id) ? preferred : ports.find((node) => !usedPorts.has(node.id));
      homes[seat] = port?.id ?? 0;
      if (port) usedPorts.add(port.id);
    });
    this.rng = options.rng ?? Math.random;
    this.state = {
      royalAudience: null,
      config,
      map,
      players: options.players.map((p, id) => ({
        ...p,
        id,
        rank: 0,
        audienceMerit: 0,
        gold: config.startingGold,
        position: homes[id]!,
        homePort: homes[id]!,
        revivalProtection: false,
        captain: false,
        bankrupt: false,
        fleet: [],
      })),
      nextShipId: 1,
      marketStock: [],
      owners: map.map(() => null),
      buildings: map.map(() => ({})),
      stockpiles: map.map(emptyStockpile),
      docks: map.map(() => []),
      market: createMarket(),
      currentPlayer: 0,
      round: 1,
      phase: 'awaitingSpin',
      lastSpin: null,
      pendingClaim: null,
      pendingBarter: null,
      pendingMerchant: null,
      pendingWyvern: false,
      battles: [],
      winner: null,
      log: [],
    };
    for (const player of this.state.players) {
      const flagship = player.navigator === undefined ? undefined : navigatorById(player.navigator)?.signatureShip;
      if (player.navigator !== undefined && !flagship) throw new Error(`Unknown navigator: ${player.navigator}`);
      for (const type of STARTING_FLEET) this.commissionShip(player.id, type, type === flagship?.type ? flagship : undefined);
    }
  }

  /** Subscribe to engine events; returns an unsubscribe function. */
  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get currentPlayer(): Player {
    return this.state.players[this.state.currentPlayer];
  }

  /** Start the first turn (separate from the constructor so listeners can attach first). */
  start(): void {
    this.log(`Round 1: ${this.currentPlayer.name} sets sail first.`);
    this.repairDockedShips();
    this.emit({ type: 'turnStarted', playerId: this.currentPlayer.id });
  }

  islandsOwnedBy(playerId: number): number {
    return this.state.owners.filter((o) => o === playerId).length;
  }

  /** Commission a ship for setup or after a game rule has authorized construction. */
  addShipToFleet(playerId: number, type: ShipType): Ship {
    return this.commissionShip(playerId, type);
  }

  private commissionShip(playerId: number, type: ShipType, signature?: SignatureShip): Ship {
    const player = this.state.players[playerId];
    if (!player) throw new Error(`Unknown player: ${playerId}`);
    if (!Object.prototype.hasOwnProperty.call(SHIP_TYPES, type)) throw new Error(`Unknown ship type: ${type}`);

    const id = this.state.nextShipId++;
    const { label, ...base } = SHIP_TYPES[type];
    const stats: ShipStats = { ...base };
    for (const [stat, bonus] of Object.entries(signature?.bonus ?? {}) as [keyof ShipStats, number][]) stats[stat] += bonus;
    const ship: Ship = signature
      ? { ...stats, id, type, name: signature.name, durability: stats.maxDurability, signature: true, cargo: {} }
      : { ...stats, id, type, name: `${label} ${id}`, durability: stats.maxDurability, cargo: {} };
    player.fleet.push(ship);
    this.emit({ type: 'shipAdded', playerId, shipId: id });
    return ship;
  }

  /** Gold plus the end-of-voyage value of every colony. */
  netWorth(playerId: number): number {
    const colonies = this.state.map
      .filter((n) => this.state.owners[n.id] === playerId)
      .reduce((sum, n) => sum + colonyValue(n) + buildingValue(this.state, n.id), 0);
    return this.state.players[playerId].gold + colonies;
  }

  /** Choose the movement distance without moving the fleet yet. */
  spinCompass(): number {
    this.assertPhase('awaitingSpin');
    this.state.royalAudience = null;
    const steps = spinCompass(this.rng);
    this.state.lastSpin = steps;
    this.state.phase = 'spinning';
    this.emit({ type: 'compassSpun', playerId: this.currentPlayer.id, steps });
    return steps;
  }

  /** Move the fleet by the compass result. Returns the nodes visited, in order. */
  sail(): number[] {
    this.assertPhase('spinning');
    this.relocations = 0;
    const player = this.currentPlayer;
    const steps = this.state.lastSpin!;
    const size = this.state.map.length;
    const path: number[] = [];
    for (let i = 1; i <= steps; i++) path.push((player.position + i) % size);

    player.position = path[path.length - 1];
    this.pendingPath = path;
    this.state.phase = 'moving';
    this.emit({ type: 'moved', playerId: player.id, path });
    this.log(`${player.name} spins ${steps}.`);
    return path;
  }

  /** Apply the effect of the stop the current fleet landed on. Call after the move animation. */
  resolveLanding(): void {
    this.assertPhase('moving');
    const player = this.currentPlayer;
    const node = this.node(player.position);

    // Each pass of (or landing on) the home port pays the royal salary, once the fleet has sailed.
    const homePasses = this.pendingPath.filter((id) => id === player.homePort).length;
    this.pendingPath = [];
    if (homePasses > 0) {
      const salary = (this.state.config.homeSalary + RANKS[player.rank].salary) * homePasses;
      this.log(`The crown pays ${player.name} a ${salary}g royal salary.`);
      this.changeGold(player, salary, 'royal salary');
    }

    switch (node.kind) {
      case 'port':
        if (node.id !== player.homePort) {
          const host = this.state.players.find((p) => p.homePort === node.id && !p.bankrupt);
          this.payForeignTax(player, host, node);
        } else this.royalAudience(player);
        break;
      case 'special':
        if (node.special === 'nightless') {
          this.state.phase = 'awaitingCargoMarket';
          this.log(`${player.name} arrives at the 24-hour market on ${node.name}.`);
          this.emit({ type: 'cargoMarketOpened', playerId: player.id, nodeId: node.id });
          return;
        }
        this.resolveSpecial(player, node);
        if (node.special === 'skeleton') {
          this.state.marketStock = ['explorer', 'cargo', 'warship'];
          this.state.phase = 'awaitingMarket';
          this.emit({ type: 'marketOffered', playerId: player.id, nodeId: node.id });
          return;
        }
        if (this.state.pendingBarter) return;
        break;
      case 'event':
        if (this.resolveEvent(player, node)) return;
        break;
      case 'island': {
        const owner = this.state.owners[node.id];
        if (owner === null) {
          if (player.gold >= (node.price ?? Infinity)) {
            this.state.phase = 'awaitingClaim';
            this.state.pendingClaim = node.id;
            this.emit({ type: 'claimOffered', playerId: player.id, nodeId: node.id });
            return; // wait for claim() / decline()
          }
          this.log(`${player.name} reaches ${node.name} but cannot afford to settle ${node.name} (${node.price}g).`);
        } else if (owner !== player.id) {
          if (player.fleet.length) {
            this.state.phase = 'awaitingToll';
            this.emit({ type: 'tollOffered', playerId: player.id, nodeId: node.id });
            return; // wait for payToll() / fight()
          }
          this.log(`${player.name} has no ships to fight with.`);
          this.collectToll(player, this.state.players[owner], node);
        } else {
          this.log(`${player.name} inspects the colony at ${node.name}.`);
          this.state.phase = 'awaitingBuild';
          this.emit({ type: 'buildOffered', playerId: player.id, nodeId: node.id });
          return;
        }
        break;
      }
    }
    this.endTurn();
  }

  private royalAudience(player: Player): void {
    const merit = playerMerit(this.state, player.id);
    const next = RANKS[player.rank + 1];
    const promoted = !!next && merit >= next.merit;
    if (promoted) player.rank++;
    const rank = RANKS[player.rank];
    const reward = promoted ? rank.purse : Math.max(0, merit - player.audienceMerit) * 2;
    player.audienceMerit = Math.max(player.audienceMerit, merit);
    const nation = player.nation ?? this.node(player.homePort).nation ?? 'your homeland';
    const message = promoted
      ? `King of ${nation} promotes ${player.name} to ${rank.name} (${rank.chineseName})! Bonus: +${rank.salary} salary, −${Math.round(rank.taxDiscount * 100)}% foreign tax. Promotion purse: ${reward}g.`
      : reward > 0 ? `King of ${nation} rewards ${player.name} with ${reward}g for new achievements.`
        : `${player.name}: the king awaits greater deeds.`;
    if (reward) this.changeGold(player, reward, promoted ? 'promotion purse' : 'royal reward');
    this.log(message);
    const audience = { playerId: player.id, rank: player.rank, promoted, reward, message };
    this.state.royalAudience = audience;
    this.emit({ type: 'royalAudience', audience });
  }

  /** Found a colony on the offered island. */
  claim(): void {
    this.assertPhase('awaitingClaim');
    const player = this.currentPlayer;
    const node = this.node(this.state.pendingClaim!);
    this.changeGold(player, -(node.price ?? 0), `colony at ${node.name}`);
    this.state.owners[node.id] = player.id;
    this.log(`${player.name} plants the flag on ${node.name}!`);
    this.emit({ type: 'claimed', playerId: player.id, nodeId: node.id });
    this.endTurn();
  }

  /** Sail on without claiming the offered island. */
  decline(): void {
    this.assertPhase('awaitingClaim');
    this.log(`${this.currentPlayer.name} sails past ${this.node(this.state.pendingClaim!).name}.`);
    this.endTurn();
  }

  /** Pay the toll at the rival colony the fleet landed on. */
  payToll(): void {
    this.assertPhase('awaitingToll');
    const player = this.currentPlayer;
    const node = this.node(player.position);
    this.collectToll(player, this.state.players[this.state.owners[node.id]!], node);
    this.endTurn();
  }

  /**
   * Attack the rival colony instead of paying: sinking every defender takes the colony,
   * losing every ship costs the sunk ships plus double toll, and a draw sends both fleets home.
   */
  fight(): BattleReport {
    this.assertPhase('awaitingToll');
    const player = this.currentPlayer;
    const node = this.node(player.position);
    const { ships: defenders, owner, fromFleet } = colonyDefenders(this.state, node.id);
    this.log(`${player.name} opens fire on ${owner.name}'s ${fromFleet ? 'fleet' : 'docked ships'} at ${node.name}!`);
    const result = fightNavalBattle(player.fleet, defenders, this.rng);
    const sink = (fleet: Ship[], sunk: Ship[]) => {
      for (const ship of sunk) fleet.splice(fleet.indexOf(ship), 1);
    };
    sink(player.fleet, result.attackerSunk);
    sink(defenders, result.defenderSunk);
    const report: BattleReport = {
      nodeId: node.id,
      attacker: player.id,
      defender: owner.id,
      outcome: result.outcome,
      rounds: result.rounds,
      attackerSunk: result.attackerSunk.map((ship) => ship.name),
      defenderSunk: result.defenderSunk.map((ship) => ship.name),
      tollPaid: 0,
    };
    const names = (sunk: string[]) => sunk.length ? sunk.join(', ') : 'none';
    this.log(`${result.rounds} rounds of cannon fire. Sunk: ${player.name} ${names(report.attackerSunk)}; ${owner.name} ${names(report.defenderSunk)}.`);
    switch (result.outcome) {
      case 'victory':
        this.state.owners[node.id] = player.id;
        this.log(`${player.name} sinks every defender and takes ${node.name} from ${owner.name}!`);
        this.emit({ type: 'claimed', playerId: player.id, nodeId: node.id });
        break;
      case 'defeat':
        this.log(`${player.name}'s fleet is sunk at ${node.name} and owes ${owner.name} double toll.`);
        report.tollPaid = this.collectToll(player, owner, node, COMBAT.defeatTollMultiplier);
        break;
      case 'draw':
        player.position = player.homePort;
        if (fromFleet) owner.position = owner.homePort;
        this.log(`Neither side yields at ${node.name}: ${player.name}${fromFleet ? ` and ${owner.name}` : ''} sail home.`);
        break;
    }
    this.state.battles.push(report);
    this.emit({ type: 'battleFought', report });
    this.endTurn();
    return report;
  }

  acceptBarter(index: number): void {
    this.assertPhase('awaitingBarter');
    const offer = Number.isInteger(index) ? this.state.pendingBarter?.[index] : undefined;
    if (!offer) throw new Error('Unknown barter offer');
    const player = this.currentPlayer;
    if (fleetQuantity(player, offer.give) < offer.giveQty) throw new Error('Not enough cargo for barter');
    const space = player.fleet.reduce((sum, ship) => sum + ship.cargoCapacity - cargoLoad(ship), 0);
    if (space + offer.giveQty < offer.receiveQty) throw new Error('Not enough cargo capacity');
    let remaining = offer.giveQty;
    for (const ship of player.fleet) {
      const take = Math.min(remaining, ship.cargo[offer.give] ?? 0);
      ship.cargo[offer.give] = (ship.cargo[offer.give] ?? 0) - take;
      remaining -= take;
    }
    remaining = offer.receiveQty;
    for (const ship of player.fleet) {
      const add = Math.min(remaining, ship.cargoCapacity - cargoLoad(ship));
      ship.cargo[offer.receive] = (ship.cargo[offer.receive] ?? 0) + add;
      remaining -= add;
    }
    this.log(`${player.name} barters ${offer.giveQty} ${offer.give} for ${offer.receiveQty} ${offer.receive} with the natives.`);
    this.endTurn();
  }

  declineBarter(): void {
    this.assertPhase('awaitingBarter');
    this.log(`${this.currentPlayer.name} declines native barter.`);
    this.endTurn();
  }

  private transferColony(): number {
    this.assertPhase('awaitingBuild');
    const { position, id } = this.currentPlayer;
    if (this.state.map[position]?.kind !== 'island' || this.state.owners[position] !== id) {
      throw new Error('Transfers require your own colony');
    }
    return position;
  }

  dockShip(shipId: number): void {
    this.transferShip(shipId, 'dock');
  }

  boardShip(shipId: number): void {
    this.transferShip(shipId, 'board');
  }

  private transferShip(shipId: number, direction: 'dock' | 'board'): void {
    const nodeId = this.transferColony();
    const player = this.currentPlayer;
    const dock = this.state.docks[nodeId];
    const source = direction === 'dock' ? player.fleet : dock;
    const target = direction === 'dock' ? dock : player.fleet;
    const index = source.findIndex((ship) => ship.id === shipId);
    if (index < 0) throw new Error('Ship not available here');
    if (direction === 'dock' && source.length <= 1) throw new Error('Fleet must keep at least one ship');
    const [ship] = source.splice(index, 1);
    target.push(ship);
    this.log(`${player.name} ${direction === 'dock' ? 'docks' : 'boards'} ${ship.name} at ${this.node(nodeId).name}.`);
    this.emit({ type: 'shipTransferred', playerId: player.id, nodeId, shipId, direction });
  }

  loadCargo(shipId: number, good: Good, qty: number): void {
    this.moveCargo(shipId, good, qty, 'load');
  }

  unloadCargo(shipId: number, good: Good, qty: number): void {
    this.moveCargo(shipId, good, qty, 'unload');
  }

  private moveCargo(shipId: number, good: Good, qty: number, direction: 'load' | 'unload'): void {
    const nodeId = this.transferColony();
    if (!GOODS.includes(good)) throw new Error('Unknown good');
    if (!Number.isSafeInteger(qty) || qty <= 0) throw new Error('Quantity must be a positive integer');
    const player = this.currentPlayer;
    const ship = player.fleet.find((candidate) => candidate.id === shipId);
    if (!ship) throw new Error('Ship must be in the fleet');
    const stock = this.state.stockpiles[nodeId];
    const stored = good === 'lumber' || good === 'iron' ? stock[good] : (stock.specialties[good] ?? 0);
    const aboard = ship.cargo[good] ?? 0;
    if (direction === 'load' ? qty > stored || qty > ship.cargoCapacity - cargoLoad(ship) : qty > aboard) {
      throw new Error('Insufficient stock, cargo or capacity');
    }
    const delta = direction === 'load' ? qty : -qty;
    ship.cargo[good] = aboard + delta;
    if (good === 'lumber' || good === 'iron') stock[good] = stored - delta;
    else stock.specialties[good] = stored - delta;
    this.log(`${player.name} ${direction === 'load' ? 'loads' : 'unloads'} ${qty} ${good} ${direction === 'load' ? 'onto' : 'from'} ${ship.name}.`);
    this.emit({ type: 'cargoMoved', playerId: player.id, nodeId, shipId, good, qty, direction });
  }

  autoLoad(): number {
    const nodeId = this.transferColony();
    let total = 0;
    for (const ship of this.currentPlayer.fleet) {
      for (const good of GOODS) {
        if (good === 'lumber' || good === 'iron') continue;
        const qty = Math.min(this.state.stockpiles[nodeId].specialties[good] ?? 0, ship.cargoCapacity - cargoLoad(ship));
        if (qty > 0) {
          this.loadCargo(ship.id, good, qty);
          total += qty;
        }
      }
    }
    this.log(`AUTO loaded ${total} specialty units.`);
    return total;
  }

  canBuild(kind: BuildingKind): boolean {
    const player = this.currentPlayer;
    const node = this.state.map[player.position];
    const cost = nextBuildingCost(this.state, player.position, kind);
    return this.state.phase === 'awaitingBuild' && node?.kind === 'island' &&
      this.state.owners[player.position] === player.id && cost !== null && player.gold >= cost;
  }

  build(kind: BuildingKind): void {
    this.assertPhase('awaitingBuild');
    if (!this.canBuild(kind)) throw new Error('Cannot build here: ownership, cost or maximum level');
    const player = this.currentPlayer;
    const nodeId = player.position;
    const level = buildingLevel(this.state, nodeId, kind) + 1;
    this.changeGold(player, -nextBuildingCost(this.state, nodeId, kind)!, BUILDINGS[kind].label);
    this.state.buildings[nodeId][kind] = level;
    this.log(`${player.name} builds ${BUILDINGS[kind].label} level ${level} at ${this.node(nodeId).name}.`);
    this.emit({ type: 'buildingBuilt', playerId: player.id, nodeId, kind, level });
  }

  finishBuilding(): void {
    this.assertPhase('awaitingBuild');
    this.endTurn();
  }

  tradeAtMarket(order: MarketOrder): void {
    const total = quoteMarketTrade(this.state, order);
    if (total === null) throw new Error('Cannot fill market order');
    const player = this.currentPlayer;
    const { side, good, quantity, shipId } = order;
    const ship = player.fleet.find((candidate) => candidate.id === shipId)!;
    const buying = side === 'buy';
    const change = buying ? quantity : -quantity;
    const aboard = (ship.cargo[good] ?? 0) + change;
    if (aboard > 0) ship.cargo[good] = aboard;
    else delete ship.cargo[good];
    this.state.market.stock[good] -= change;
    this.changeGold(player, buying ? -total : total, 'Nightless Island market');
    this.log(`${player.name} ${buying ? 'buys' : 'sells'} ${quantity} ${good} for ${total}g at Nightless Island.`);
    this.emit({ ...order, type: 'marketTrade', playerId: player.id, total });
  }

  finishTrading(): void {
    this.assertPhase('awaitingCargoMarket');
    this.endTurn();
  }

  canBuildShip(type: ShipType): boolean {
    const player = this.currentPlayer;
    const nodeId = player.position;
    if (this.state.phase !== 'awaitingBuild' || this.state.map[nodeId]?.kind !== 'island' ||
      this.state.owners[nodeId] !== player.id || !Object.hasOwn(SHIP_RECIPES, type)) return false;

    const recipe = SHIP_RECIPES[type];
    const stock = this.state.stockpiles[nodeId];
    return buildingLevel(this.state, nodeId, 'shipyard') >= recipe.yardLevel &&
      stock.lumber >= recipe.lumber && stock.iron >= recipe.iron;
  }

  buildShip(type: ShipType): Ship {
    this.assertPhase('awaitingBuild');
    if (!this.canBuildShip(type)) throw new Error('Cannot build ship here: ownership, shipyard level, ship type or materials');
    const player = this.currentPlayer;
    const node = this.node(player.position);
    const stock = this.state.stockpiles[node.id];
    const recipe = SHIP_RECIPES[type];
    stock.lumber -= recipe.lumber;
    stock.iron -= recipe.iron;
    const ship = this.addShipToFleet(player.id, type);
    this.log(`${player.name} launches ${ship.name} at ${node.name}.`);
    return ship;
  }

  /** Let the built-in AI make the current player's pending decision. */
  decideForAI(): void {
    if (this.state.phase === 'awaitingMerchant') {
      this.acceptMerchant();
      return;
    }
    if (this.state.phase === 'awaitingWyvern') {
      this.wyvernFly(aiWyvernTarget(this.state, this.currentPlayer));
      return;
    }
    if (this.state.phase === 'awaitingToll') {
      if (aiShouldFight(this.state, this.currentPlayer)) this.fight();
      else this.payToll();
      return;
    }
    if (this.state.phase === 'awaitingMarket') {
      this.finishMarket();
      return;
    }
    if (this.state.phase === 'awaitingBarter') {
      const choice = aiBarterChoice(this.currentPlayer, this.state.pendingBarter!);
      if (choice === null) this.declineBarter();
      else this.acceptBarter(choice);
      return;
    }
    if (this.state.phase === 'awaitingBuild') {
      let kind = aiBuildingChoice(this.state, this.currentPlayer);
      while (kind !== null && this.canBuild(kind)) {
        this.build(kind);
        kind = aiBuildingChoice(this.state, this.currentPlayer);
      }
      this.autoLoad();
      this.finishBuilding();
      return;
    }
    if (this.state.phase === 'awaitingCargoMarket') {
      for (const ship of this.currentPlayer.fleet) {
        for (const good of GOODS) {
          const quantity = ship.cargo[good] ?? 0;
          if (quantity > 0) this.tradeAtMarket({ side: 'sell', shipId: ship.id, good, quantity });
        }
      }
      this.finishTrading();
      return;
    }
    if (this.state.phase === 'awaitingClaim') {
      const player = this.currentPlayer;
      if (aiShouldClaim(this.state, player, this.state.pendingClaim!)) this.claim();
      else this.decline();
    }
  }

  // --- internals -----------------------------------------------------------

  private atMarket(): boolean {
    return this.state.phase === 'awaitingMarket' && !this.currentPlayer.bankrupt &&
      this.node(this.currentPlayer.position)?.special === 'skeleton';
  }

  canBuyUsedShip(type: ShipType): boolean {
    return this.atMarket() && this.state.marketStock.includes(type) && this.currentPlayer.gold >= USED_SHIP_PRICES[type];
  }

  buyUsedShip(type: ShipType): Ship {
    if (!this.canBuyUsedShip(type)) throw new Error('Cannot buy ship: market, stock or gold');
    this.state.marketStock.splice(this.state.marketStock.indexOf(type), 1);
    this.changeGold(this.currentPlayer, -USED_SHIP_PRICES[type], 'second-hand ship');
    const ship = this.addShipToFleet(this.currentPlayer.id, type);
    ship.durability = Math.floor(ship.maxDurability * USED_SHIP_CONDITION);
    this.log(`${this.currentPlayer.name} buys ${ship.name} at Skeleton Island.`);
    return ship;
  }

  canSellShip(shipId: number): boolean {
    return this.atMarket() && this.currentPlayer.fleet.length > 1 &&
      this.currentPlayer.fleet.some((ship) => ship.id === shipId && cargoLoad(ship) === 0);
  }

  sellShip(shipId: number): void {
    if (!this.canSellShip(shipId)) throw new Error('Cannot sell ship: market, last ship, ownership or cargo');
    const fleet = this.currentPlayer.fleet;
    const [ship] = fleet.splice(fleet.findIndex((ship) => ship.id === shipId), 1);
    const price = shipSalePrice(ship);
    this.changeGold(this.currentPlayer, price, 'ship sale');
    this.emit({ type: 'shipSold', playerId: this.currentPlayer.id, shipName: ship.name, price });
    this.log(`${this.currentPlayer.name} sells ${ship.name} at Skeleton Island.`);
  }

  finishMarket(): void {
    if (!this.atMarket()) throw new Error('Not at Skeleton Island market');
    this.state.marketStock = [];
    this.endTurn();
  }

  private resolveSpecial(player: Player, node: MapNode): void {
    const r = SEA_RULES;
    this.log(`${player.name} visits ${node.name} (${node.chineseName ?? ''}).`);
    switch (node.special) {
      case 'skeleton':
        if (player.gold >= r.tribute) {
          this.log(`The pirates demand tribute from ${player.name} at their second-hand ship market.`);
          this.changeGold(player, -r.tribute, 'pirate tribute');
        } else {
          this.log(`The pirates buy ${player.name}'s scrap ship fittings.`);
          this.changeGold(player, r.scrap, 'scrap sale');
        }
        break;
      case 'treasure':
        if (player.gold < r.ticket) { this.log(`${player.name} cannot afford a lottery ticket.`); break; }
        this.changeGold(player, -r.ticket, 'lottery ticket');
        if (this.rng() < r.lotteryChance) {
          this.log(`${player.name}'s lottery ticket wins the grand prize!`);
          this.changeGold(player, r.lotteryPrize, 'lottery prize');
        } else this.log(`${player.name}'s lottery ticket wins no prize.`);
        break;
      case 'mist': {
        let stones: number = r.nimStones;
        let human = true;
        while (stones > 0) {
          const optimal = (stones - 1) % 4;
          const take = human ? 1 + Math.floor(this.rng() * Math.min(3, stones)) : (optimal || 1);
          stones -= take;
          if (stones <= 0) break;
          human = !human;
        }
        this.log(`${player.name} plays hermit Nim: take 1–3 stones, last loses. ${human ? 'The hermit wins.' : `${player.name} wins the prize!`}`);
        if (!human) this.changeGold(player, r.nimPrize, 'Nim prize');
        break;
      }
      case 'revival': {
        const damage = player.fleet.reduce((sum, ship) => sum + ship.maxDurability - ship.durability, 0);
        const points = Math.min(damage, Math.floor(Math.max(0, player.gold) / REPAIR_GOLD_PER_POINT));
        let remaining = points;
        for (const ship of player.fleet) {
          const repaired = Math.min(remaining, ship.maxDurability - ship.durability);
          ship.durability += repaired;
          remaining -= repaired;
        }
        if (damage === 0) this.log(`${player.name}'s fleet already sound: no repair fee.`);
        else {
          this.changeGold(player, -points * REPAIR_GOLD_PER_POINT, 'revival repairs');
          this.log(`Revival repairs ${player.name}'s fleet: restored ${points}/${damage} durability for ${points * REPAIR_GOLD_PER_POINT}g.${points < damage ? ' Insufficient gold; partial repairs in fleet order.' : ' Fleet fully repaired.'}`);
        }
        player.revivalProtection = true;
        this.log(`Revival protection blocks ${player.name}'s next sea hazard.`);
        break;
      }
      case 'wind': {
        const offers = barterOffers(player, this.rng);
        if (!offers.length) {
          this.log(`The natives have no use for ${player.name}'s cargo. No barter today.`);
          break;
        }
        this.state.pendingBarter = offers;
        this.state.phase = 'awaitingBarter';
        this.emit({ type: 'barterOffered', playerId: player.id, nodeId: node.id });
        break;
      }
      case 'dragonSnake':
        if (player.gold < r.captainPrice) { this.log(`${player.name} cannot afford to recruit a captain.`); break; }
        this.changeGold(player, -r.captainPrice, 'captain recruitment');
        player.captain = true;
        this.log(`A captain joins ${player.name}: their next colony toll is halved.`);
        break;
    }
  }

  acceptMerchant(): void {
    this.assertPhase('awaitingMerchant');
    const offer = this.state.pendingMerchant!;
    const player = this.currentPlayer;
    if (fleetQuantity(player, offer.good) < offer.quantity) throw new Error('Not enough cargo');
    let remaining = offer.quantity;
    for (const ship of player.fleet) {
      const units = Math.min(remaining, ship.cargo[offer.good] ?? 0);
      ship.cargo[offer.good] = (ship.cargo[offer.good] ?? 0) - units;
      if (ship.cargo[offer.good] === 0) delete ship.cargo[offer.good];
      remaining -= units;
    }
    this.changeGold(player, offer.gold, 'merchant');
    this.emit({ type: 'seaEvent', playerId: player.id, event: 'merchant', outcome: 'accepted', ...offer });
    this.endTurn();
  }

  declineMerchant(): void {
    this.assertPhase('awaitingMerchant');
    this.emit({ type: 'seaEvent', playerId: this.currentPlayer.id, event: 'merchant', outcome: 'declined' });
    this.endTurn();
  }

  wyvernFly(nodeId: number): void {
    this.assertPhase('awaitingWyvern');
    if (!Number.isInteger(nodeId) || !this.state.map[nodeId]) throw new Error('Unknown destination');
    const player = this.currentPlayer;
    player.position = nodeId;
    this.state.pendingWyvern = false;
    this.state.phase = 'moving';
    this.pendingPath = [nodeId];
    this.emit({ type: 'seaEvent', playerId: player.id, event: 'wyvern', outcome: 'relocated', destination: nodeId });
    this.emit({ type: 'moved', playerId: player.id, path: [nodeId] });
  }

  private resolveEvent(player: Player, node: MapNode): boolean {
    const event = node.event!;
    const announce = (outcome: SeaEventResult['outcome'], details: Partial<Omit<SeaEventResult, 'type' | 'playerId' | 'event' | 'outcome'>> = {}) =>
      this.emit({ type: 'seaEvent', playerId: player.id, event, outcome, ...details });
    if (['storm', 'pirates', 'smallMonster', 'largeMonster', 'turtle', 'whirlpool'].includes(event) && player.revivalProtection) {
      player.revivalProtection = false;
      announce('protected');
      return false;
    }
    const hurt = (ships: Ship[], amount: number) => ships.reduce((total, ship) => {
      const damage = Math.min(amount, Math.max(0, ship.durability - 1));
      ship.durability -= damage;
      return total + damage;
    }, 0);
    const sink = () => player.fleet.length > 1 ? [player.fleet.splice(Math.floor(this.rng() * player.fleet.length), 1)[0].id] : [];
    switch (event) {
      case 'pirates': {
        const pirate: Ship = { id: -1, name: 'Pirate', type: 'warship', cargo: {}, ...SHIP_TYPES.warship,
          durability: SEA_RULES.pirateDurability, maxDurability: SEA_RULES.pirateDurability, firepower: SEA_RULES.pirateFirepower };
        const before = player.fleet.reduce((sum, ship) => sum + ship.durability, 0);
        const result = fightNavalBattle(player.fleet, [pirate], this.rng);
        const lost = result.attackerSunk.map((ship) => ship.id);
        player.fleet = player.fleet.filter((ship) => !lost.includes(ship.id));
        if (!player.fleet.length && result.attackerSunk.length) {
          const survivor = result.attackerSunk.pop()!;
          survivor.durability = 1;
          player.fleet.push(survivor);
          lost.splice(lost.indexOf(survivor.id), 1);
        }
        const won = result.outcome === 'victory';
        const gold = won ? SEA_RULES.pirateLoot : -SEA_RULES.pirates;
        this.changeGold(player, gold, 'pirates');
        announce(won ? 'victory' : 'defeat', { gold, shipsLost: lost,
          damage: before - player.fleet.reduce((sum, ship) => sum + ship.durability, 0) });
        break;
      }
      case 'smallMonster':
      case 'largeMonster': {
        const large = event === 'largeMonster';
        const targets = large ? player.fleet : player.fleet.length ? [player.fleet[Math.floor(this.rng() * player.fleet.length)]] : [];
        const damage = hurt(targets, large ? SEA_RULES.largeMonsterDamage : SEA_RULES.smallMonsterDamage);
        const shipsLost = large && this.rng() < SEA_RULES.monsterSinkChance ? sink() : [];
        const gold = -SEA_RULES[event];
        this.changeGold(player, gold, event);
        announce(shipsLost.length ? 'sunk' : 'damaged', { gold, damage, shipsLost });
        break;
      }
      case 'turtle': {
        const shipsLost = sink();
        const damage = shipsLost.length ? 0 : hurt(player.fleet, SEA_RULES.turtleDamage);
        announce(shipsLost.length ? 'sunk' : 'damaged', { shipsLost, damage });
        break;
      }
      case 'bottle': {
        const roll = this.rng();
        if (roll < SEA_RULES.bottlePrizeChance) {
          this.changeGold(player, SEA_RULES.bottlePrize, event);
          announce('specialPrize', { gold: SEA_RULES.bottlePrize });
        } else if (roll < SEA_RULES.bottlePrizeChance + SEA_RULES.bottleRepairChance) {
          for (const ship of player.fleet) ship.durability = ship.maxDurability;
          announce('repaired');
        } else {
          this.changeGold(player, SEA_RULES.bottle, event);
          announce('gold', { gold: SEA_RULES.bottle });
        }
        break;
      }
      case 'floatingCargo': {
        const specialties = GOODS.filter((good): good is Specialty => good !== 'lumber' && good !== 'iron');
        let quantity = 0;
        const good = specialties[Math.floor(this.rng() * specialties.length)];
        if (this.rng() >= SEA_RULES.cargoGoldChance) {
          for (const ship of player.fleet) {
            const units = Math.min(SEA_RULES.cargoUnits - quantity, Math.max(0, ship.cargoCapacity - cargoLoad(ship)));
            ship.cargo[good] = (ship.cargo[good] ?? 0) + units;
            quantity += units;
          }
        }
        if (quantity) announce('cargo', { good, quantity });
        else {
          this.changeGold(player, SEA_RULES.floatingCargo, event);
          announce('gold', { gold: SEA_RULES.floatingCargo });
        }
        break;
      }
      case 'merchant': {
        const good = GOODS.find((good): good is Specialty => good !== 'lumber' && good !== 'iron' && fleetQuantity(player, good) > 0);
        if (!good) { announce('noTrade'); break; }
        const quantity = Math.min(SEA_RULES.merchantUnits, fleetQuantity(player, good));
        const offer = { good, quantity, gold: Math.round(GOOD_VALUES[good] * quantity * SEA_RULES.merchantPremium) };
        this.state.pendingMerchant = offer;
        this.state.phase = 'awaitingMerchant';
        this.emit({ type: 'merchantOffered', playerId: player.id, offer });
        return true;
      }
      case 'wyvern':
        if (this.relocations++ >= SEA_RULES.relocationLimit) { announce('escaped'); break; }
        this.state.pendingWyvern = true;
        this.state.phase = 'awaitingWyvern';
        this.emit({ type: 'wyvernOffered', playerId: player.id });
        return true;
      case 'whirlpool': {
        if (this.rng() < SEA_RULES.whirlpoolDamageChance) {
          const before = player.fleet.reduce((sum, ship) => sum + ship.durability, 0);
          this.damageFleet(player);
          this.changeGold(player, -SEA_RULES.whirlpoolLoss, event);
          announce('damaged', { gold: -SEA_RULES.whirlpoolLoss, damage: before - player.fleet.reduce((sum, ship) => sum + ship.durability, 0) });
          break;
        }
        if (this.relocations++ >= SEA_RULES.relocationLimit) { announce('escaped'); break; }
        const size = this.state.map.length;
        const direction = this.rng() < 0.5 ? -1 : 1;
        const path = Array.from({ length: SEA_RULES.whirlpoolSteps }, (_, i) => (player.position + direction * (i + 1) + size * SEA_RULES.whirlpoolSteps) % size);
        player.position = path[path.length - 1];
        this.pendingPath = path;
        announce('relocated', { destination: player.position });
        this.emit({ type: 'moved', playerId: player.id, path });
        return true;
      }
      case 'treasure': {
        const { min, max, step } = EVENT_GOLD.treasure;
        const amount = min + Math.floor(this.rng() * ((max - min) / step + 1)) * step;
        this.log(`${player.name} hauls up a sunken chest worth ${amount}g!`);
        this.changeGold(player, amount, 'treasure');
        announce('gold', { gold: amount });
        break;
      }
      case 'storm': {
        const stormDamage = player.fleet.reduce((sum, ship) => sum + Math.min(ship.durability, SEA_HAZARD_DAMAGE), 0);
        this.damageFleet(player);
        this.state.market.repairDemandThroughRound = this.state.round + 1;
        const { min, max, step } = EVENT_GOLD.storm;
        const amount = min + Math.floor(this.rng() * ((max - min) / step + 1)) * step;
        this.log(`A storm batters ${player.name}'s fleet: repairs cost ${amount}g.`);
        this.changeGold(player, -amount, 'storm repairs');
        announce('damaged', { gold: -amount, damage: stormDamage });
        break;
      }
      case 'tradeWind': {
        for (const good of GOODS) this.state.market.stock[good] += 3;
        const amount = EVENT_GOLD.tradeWind.perColony * this.islandsOwnedBy(player.id) + EVENT_GOLD.tradeWind.base;
        this.log(`Trade winds carry ${player.name}'s goods to market: +${amount}g.`);
        this.changeGold(player, amount, 'trade');
        announce('gold', { gold: amount });
        break;
      }
    }
    return false;
  }

  /** Charges the toll (times `multiplier` after a lost battle); returns what the owner received. */
  private collectToll(player: Player, owner: Player, node: MapNode, multiplier = 1): number {
    const toll = tollDue(this.state, player, node.id, multiplier);
    if (player.captain) this.log(`${player.name}'s captain negotiates half the toll.`);
    player.captain = false;
    const amount = Math.min(toll, Math.max(player.gold, 0));
    this.log(`${player.name} pays ${amount}g ${multiplier > 1 ? 'double ' : ''}toll to ${owner.name} at ${node.name}.`);
    this.changeGold(player, -toll, `toll at ${node.name}`);
    this.changeGold(owner, amount, `toll at ${node.name}`);
    this.emit({ type: 'tollPaid', from: player.id, to: owner.id, amount });
    return amount;
  }

  private payForeignTax(player: Player, host: Player | undefined, node: MapNode): void {
    const tax = foreignTaxDue(player.rank);
    const paid = Math.min(player.gold, tax);
    let shortfall = tax - paid;
    this.log(`${player.name} pays ${paid}g foreign tax to ${host?.name ?? 'the crown'} at ${node.name} (${tax}g due).`);
    this.changeGold(player, -paid, 'foreign tax');
    if (host) this.changeGold(host, paid, 'foreign tax');
    const cheapestFirst = [...player.fleet].sort((a, b) => shipSalePrice(a) - shipSalePrice(b) || a.id - b.id);
    for (const ship of cheapestFirst) {
      if (shortfall <= 0) break;
      const value = shipSalePrice(ship);
      player.fleet.splice(player.fleet.indexOf(ship), 1);
      if (host) host.fleet.push(ship);
      shortfall -= value;
      this.log(`${player.name}'s ${ship.name} is seized by ${host?.name ?? 'the crown'} for ${value}g toward foreign tax.`);
    }
    if (shortfall > 0 || player.fleet.length === 0) this.declareBankrupt(player);
  }

  private changeGold(player: Player, delta: number, reason: string): void {
    player.gold += delta;
    this.emit({ type: 'goldChanged', playerId: player.id, delta, reason });
    if (player.gold < 0) this.declareBankrupt(player);
  }

  private declareBankrupt(player: Player): void {
    if (!player.bankrupt) {
      player.gold = 0;
      player.bankrupt = true;
      // A bankrupt navigator's colonies return to the wild.
      this.state.owners = this.state.owners.map((o, id) => {
        if (o !== player.id) return o;
        this.state.buildings[id] = {};
        this.state.stockpiles[id] = emptyStockpile();
        this.state.docks[id] = [];
        return null;
      });
      this.log(`${player.name} is bankrupt! Their colonies fall back to neutral.`);
      this.emit({ type: 'bankrupt', playerId: player.id });
    }
  }

  private endTurn(): void {
    this.state.pendingMerchant = null;
    this.state.pendingWyvern = false;
    this.state.pendingClaim = null;
    this.state.pendingBarter = null;
    if (this.checkVictory()) return;

    const lastPosition = turnOrderPosition(this.state, this.state.currentPlayer);
    let next = this.nextActivePlayer(lastPosition + 1);
    if (next === undefined) {
      this.produceColonyGoods();
      advanceMarket(this.state.market);
      this.state.round += 1;
      if (this.checkVictory()) return;
      this.log(`Round ${this.state.round} begins.`);
      next = this.nextActivePlayer(0)!;
    }

    this.state.currentPlayer = next;
    this.state.phase = 'awaitingSpin';
    this.repairDockedShips();
    this.emit({ type: 'turnStarted', playerId: next });
  }

  private damageFleet(player: Player): void {
    for (const ship of player.fleet) {
      ship.durability = Math.max(0, ship.durability - SEA_HAZARD_DAMAGE);
    }
    this.log(`${player.name}'s ships each lose up to ${SEA_HAZARD_DAMAGE} durability (minimum 0; ships are not sunk).`);
  }

  private repairDockedShips(): void {
    for (const node of this.state.map) {
      if (this.state.owners[node.id] !== this.currentPlayer.id || !buildingLevel(this.state, node.id, 'repairYard')) continue;
      let repaired = 0;
      for (const ship of this.state.docks[node.id]) {
        repaired += ship.maxDurability - ship.durability;
        ship.durability = ship.maxDurability;
      }
      if (repaired > 0) this.log(`${this.currentPlayer.name}'s repair yard at ${node.name} restores ${repaired} docked ship durability for free.`);
    }
  }

  private produceColonyGoods(): void {
    for (const { id, kind, specialty } of this.state.map) {
      if (kind !== 'island' || this.state.owners[id] === null) continue;
      const produced = colonyProduction(this.state, id);
      const stockpile = this.state.stockpiles[id];
      stockpile.lumber += produced.lumber;
      stockpile.iron += produced.iron;
      if (specialty && produced.specialty > 0) {
        stockpile.specialties[specialty] = (stockpile.specialties[specialty] ?? 0) + produced.specialty;
      }
    }
  }

  private nextActivePlayer(fromPosition: number): number | undefined {
    const { players } = this.state;
    for (let i = fromPosition; i < players.length; i++) {
      const seat = seatAtTurnOrderPosition(this.state, i);
      if (!players[seat].bankrupt) return seat;
    }
  }

  private checkVictory(): boolean {
    const { players, config } = this.state;
    const alive = players.filter((p) => !p.bankrupt);
    let winner: Player | undefined;
    let reason = '';

    const conqueror = alive.find((p) => this.islandsOwnedBy(p.id) >= config.islandsToWin);
    if (conqueror) {
      winner = conqueror;
      reason = `claimed ${config.islandsToWin} islands for the crown`;
    } else if (players.length > 1 && alive.length === 1) {
      winner = alive[0];
      reason = 'is the last navigator afloat';
    } else if (alive.length === 0) {
      winner = players[0];
      reason = 'outlasted the sea';
    } else if (this.state.round > config.maxRounds) {
      winner = alive.reduce((a, b) => (this.netWorth(b.id) > this.netWorth(a.id) ? b : a));
      reason = `is the richest navigator after ${config.maxRounds} rounds`;
    }

    if (!winner) return false;
    this.state.phase = 'gameOver';
    this.state.winner = winner.id;
    this.log(`${winner.name} ${reason}!`);
    this.emit({ type: 'gameOver', winner: winner.id, reason });
    return true;
  }

  private node(id: number): MapNode {
    return this.state.map[id];
  }

  private log(message: string): void {
    this.state.log.push(message);
    this.emit({ type: 'log', message });
  }

  private assertPhase(phase: GameState['phase']): void {
    if (this.state.phase !== phase) {
      throw new Error(`Expected phase ${phase}, but the game is in ${this.state.phase}`);
    }
  }

  private emit(event: GameEvent): void {
    if (event.type === 'seaEvent') {
      this.log(`${this.state.players[event.playerId].name}: ${seaEventText(event, event.destination === undefined ? undefined : this.node(event.destination).name)}`);
    }
    if (event.type === 'merchantOffered') {
      const { good, quantity, gold } = event.offer;
      this.log(`A merchant offers ${this.state.players[event.playerId].name} ${gold}g for ${quantity} aboard ${good}.`);
    }
    if (event.type === 'wyvernOffered') this.log(`A wyvern offers to carry ${this.state.players[event.playerId].name} to any destination.`);
    for (const listener of this.listeners) listener(event, this.state);
  }
}
