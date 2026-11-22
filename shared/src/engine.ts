import { aiShouldClaim, aiBuildingChoice, aiBarterChoice, aiShouldFight, aiWyvernTarget, aiLotteryPickCount,
  aiTravelTarget, aiBattleStrategy, aiShipChoice, aiUsedShipChoice, aiUsedShipSale, aiMarketPurchase, aiMistTake } from './ai';
import { STRATEGIES, STRATEGY_RULES, type StrategyId } from './strategies';
import { COMBAT, colonyDefenders, fightNavalBattle, tollDue } from './combat';
import { barterOffers, fleetQuantity, GOOD_VALUES } from './barter';
import { LOTTERY, drawLotteryBalls, lotteryMatches, type LotteryDraw } from './lottery';
import { HERMITS, NIM_MAX_TAKE, hermitStoneTake, type HermitId, type MistResult } from './mist';
import { CAPTAINS, MAX_CAPTAINS, captainBonus, discountedByCaptains, recruitOffers, aiRecruitChoice } from './captains';
import { BUILDINGS, buildingLevel, nextBuildingCost, colonyProduction } from './buildings';
import type { BuildingKind } from './types';
import { SEA_RULES } from './seaRules';
import { seaEventTx } from './seaEvents';
import { localize, ref, tx, type Text } from './i18n';
import { RANKS, playerMerit, foreignTaxDue } from './ranks';
export { SEA_RULES } from './seaRules';
import { spinCompass, type Rng } from './compass';
import { createDefaultMap } from './map';
import { walkPath, WIND_DIRECTIONS } from './graph';
import { GAME_MODES, hasRoundLimit } from './modes';
import { campaignRoster, campaignStage, type CampaignObjective, type CampaignSetup, type CampaignState } from './campaign';
import { advanceMarket, createMarket, quoteMarketTrade } from './market';
import { seatAtTurnOrderPosition, turnOrderPosition, SEA_HAZARD_DAMAGE } from './rules';
import { GameView } from './gameView';
import { SHIP_RECIPES, SHIP_TYPES, STARTING_FLEET, GOODS, cargoLoad, USED_SHIP_PRICES, USED_SHIP_CONDITION, shipSalePrice } from './ships';
import type { Good, SeaEventResult, Specialty } from './types';
import { navigatorById, type SignatureShip } from './navigators';
import type { VictoryKind, BattleReport, ColonyStockpile, GameConfig, GameEvent, GameState, MapNode, MarketOrder, Player, PlayerSetup, Ship, ShipStats, ShipType } from './types';

export const DEFAULT_CONFIG: GameConfig = {
  startingStrategies: 3,
  startingGold: 1400,
  homeSalary: 400,
  ...GAME_MODES[0].config,
};

export const EVENT_GOLD = {
  treasure: { min: 50, max: 200, step: 50 },
  storm: { min: 50, max: 100, step: 25 },
  tradeWind: { base: 50, perColony: 30 },
} as const;

export type EngineOptions = {
  map?: MapNode[];
  rng?: Rng;
} & ({ players: PlayerSetup[]; config?: Partial<GameConfig>; campaign?: never } |
     { campaign: CampaignSetup; players?: never; config?: never });

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
const STRATEGY_SOURCES_ZH: Record<string, string> = {
  'the king’s commission': '国王的委任', 'starting hand': '起始手牌', 'hermit Nim': '隐士棋局', 'drifting bottle': '漂流玻璃瓶',
};

export class GameEngine extends GameView {
  private readonly rng: Rng;
  private readonly listeners = new Set<Listener>();
  private relocations = 0;
  /** Stops sailed by the current roll, settled in resolveLanding(). */
  private pendingPath: number[] = [];

  constructor(options: EngineOptions) {
    const stage = options.campaign && campaignStage(options.campaign.stage);
    const players = options.campaign ? campaignRoster(options.campaign.navigator, stage!) : options.players;
    if (players.length < 1) throw new Error('At least one player is required');
    const map = options.map ?? createDefaultMap();
    const config = { ...DEFAULT_CONFIG, ...(stage?.config ?? options.config) };
    const islandCount = map.filter((node) => node.kind === 'island').length;
    if (islandCount > 0) config.islandsToWin = Math.min(config.islandsToWin, islandCount);
    const ports = map.filter((node) => node.kind === 'port');
    const usedPorts = new Set<number>();
    const homes = players.map((player) => {
      const port = ports.find((node) => node.nation === player.nation && player.nation && !usedPorts.has(node.id));
      if (port) usedPorts.add(port.id);
      return port?.id;
    });
    players.forEach((_, seat) => {
      if (homes[seat] !== undefined) return;
      const preferred = ports[seat];
      const port = preferred && !usedPorts.has(preferred.id) ? preferred : ports.find((node) => !usedPorts.has(node.id));
      homes[seat] = port?.id ?? 0;
      if (port) usedPorts.add(port.id);
    });
    super({
      wind: { direction: 'N', turnsLeft: 3 },
      hoardNode: null,
      strategyUsed: false,
      inspired: false,
      royalAudience: null,
      campaign: stage ? { stage: stage.id, playerId: 0, progress: {}, status: 'active' } : null,
      config,
      map,
      players: players.map((p, id) => ({
        ...p,
        id,
        rank: 0,
        audienceMerit: 0,
        gold: config.startingGold,
        position: homes[id]!,
        homePort: homes[id]!,
        revivalProtection: false,
        captains: [],
        bankrupt: false,
        fleet: [],
        strategies: [],
        knownHoard: null,
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
      lottery: null,
      lotteryDraws: [],
      mistDuel: null,
      mistResults: [],
      revivalReport: null,
      pendingRecruits: null,
      battles: [],
      winner: null,
      victory: null,
      log: [],
    });
    this.rng = options.rng ?? Math.random;
    this.buryHoard();
    for (const player of this.state.players) {
      const pool = Object.keys(STRATEGIES) as StrategyId[];
      const count = Math.min(config.startingStrategies, STRATEGY_RULES.handCap, pool.length);
      if (count > 0 && player.id === this.state.campaign?.playerId) {
        this.gainStrategy(player.id, 'the king’s commission', 'navigate');
        pool.splice(pool.indexOf('navigate'), 1);
      }
      for (let i = player.strategies.length; i < count; i++) {
        const card = pool.splice(Math.floor(this.rng() * pool.length), 1)[0];
        this.gainStrategy(player.id, 'starting hand', card);
      }
    }
    for (const player of this.state.players) {
      const flagship = player.navigator === undefined ? undefined : navigatorById(player.navigator)?.signatureShip;
      if (player.navigator !== undefined && !flagship) throw new Error(`Unknown navigator: ${player.navigator}`);
      for (const type of STARTING_FLEET) this.commissionShip(player.id, type, type === flagship?.type ? flagship : undefined);
    }
    this.state.wind = { direction: WIND_DIRECTIONS[Math.floor(this.rng() * 4)], turnsLeft: 2 + Math.floor(this.rng() * 3) };
  }

  /** Subscribe to engine events; returns an unsubscribe function. */
  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private buryHoard(previous?: number): void {
    const nodes = this.state.map.filter((n) => n.event === 'treasure' && n.id !== previous);
    this.state.hoardNode = nodes.length ? nodes[Math.floor(this.rng() * nodes.length)].id : null;
  }

  gainStrategy(playerId: number, source: string, card?: StrategyId): boolean {
    const player = this.state.players[playerId];
    const ids = Object.keys(STRATEGIES) as StrategyId[];
    card ??= ids[Math.floor(this.rng() * ids.length)];
    if (player.strategies.length >= STRATEGY_RULES.handCap) {
      this.log(tx("{p}'s hand is full; {s} is discarded.", '{p} 的手牌已满，「{s}」被弃置。', { p: ref.player(player.id), s: ref.strategy(card) }));
      return false;
    }
    player.strategies.push(card);
    this.log(tx('{p} gains {s} ({src}).', '{p} 获得谋略「{s}」（{src}）。', { p: ref.player(player.id), s: ref.strategy(card), src: tx(source, STRATEGY_SOURCES_ZH[source] ?? source) }));
    this.emit({ type: 'strategyGained', playerId, card, source });
    return true;
  }

  private readonly strategyHandlers: Record<StrategyId, (target?: number) => void> = {
    navigate: (target) => {
      this.relocations = 0;
      this.pendingPath = [];
      this.currentPlayer.position = target!;
      this.state.phase = 'moving';
      this.resolveLanding();
    },
    locate: () => { this.currentPlayer.knownHoard = this.state.hoardNode; },
    inspire: () => { this.state.inspired = true; },
    mislead: () => { colonyDefenders(this.state, this.currentPlayer.position).ships.shift(); },
    betray: () => { this.currentPlayer.fleet.push(colonyDefenders(this.state, this.currentPlayer.position).ships.shift()!); },
  };

  useStrategy(id: StrategyId, target?: number): void {
    if (!this.canUseStrategy(id, target)) throw new Error('Cannot use strategy');
    const player = this.currentPlayer;
    player.strategies.splice(player.strategies.indexOf(id), 1);
    this.state.strategyUsed = true;
    this.log(target === undefined ? tx('{p} uses {s}.', '{p} 使用了「{s}」。', { p: ref.player(player.id), s: ref.strategy(id) })
      : tx('{p} uses {s} to {n}.', '{p} 使用「{s}」前往{n}。', { p: ref.player(player.id), s: ref.strategy(id), n: ref.node(target) }));
    this.strategyHandlers[id](target);
    this.emit({ type: 'strategyUsed', playerId: player.id, card: id, target });
  }

  /** Start the first turn (separate from the constructor so listeners can attach first). */
  start(): void {
    this.log(tx('Round 1: {p} sets sail first.', '第 1 回合：{p} 率先启航。', { p: ref.player(this.currentPlayer.id) }));
    this.repairDockedShips();
    this.emit({ type: 'turnStarted', playerId: this.currentPlayer.id });
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
    const path = walkPath(this.state.map, player.position, steps, this.state.wind.direction);

    player.position = path[path.length - 1];
    this.pendingPath = path;
    this.state.phase = 'moving';
    this.emit({ type: 'moved', playerId: player.id, path });
    this.log(tx('{p} spins {n}.', '{p} 转动罗盘：{n} 步。', { p: ref.player(player.id), n: steps }));
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
      const salary = (this.state.config.homeSalary + RANKS[player.rank].salary + captainBonus(player, 'salary')) * homePasses;
      this.log(tx('The crown pays {p} a {g}g royal salary.', '王室向 {p} 支付 {g} 金币薪俸。', { p: ref.player(player.id), g: salary }));
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
          this.log(tx('{p} arrives at the 24-hour market on {n}.', '{p} 抵达{n}的 24 小时市场。', { p: ref.player(player.id), n: ref.node(node.id) }));
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
        if (this.state.pendingBarter || this.state.pendingRecruits || this.state.lottery || this.state.mistDuel || this.state.revivalReport) return;
        break;
      case 'event':
        if (this.resolveEvent(player, node)) return;
        break;
      case 'island': {
        const owner = this.state.owners[node.id];
        if (owner === null) {
          this.state.phase = 'awaitingClaim';
          this.state.pendingClaim = node.id;
          this.claim();
          return;
        } else if (owner !== player.id) {
          if (player.fleet.length) {
            this.state.phase = 'awaitingToll';
            this.emit({ type: 'tollOffered', playerId: player.id, nodeId: node.id });
            return; // wait for payToll() / fight()
          }
          this.log(tx('{p} has no ships to fight with.', '{p} 没有可以作战的船只。', { p: ref.player(player.id) }));
          this.collectToll(player, this.state.players[owner], node);
        } else {
          this.log(tx('{p} inspects the colony at {n}.', '{p} 视察{n}的殖民地。', { p: ref.player(player.id), n: ref.node(node.id) }));
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
    const homeNation = player.nation ?? this.node(player.homePort).nation;
    const nation = homeNation ? ref.nation(homeNation) : tx('your homeland', '你的祖国');
    const params = { p: ref.player(player.id), nation, rank: rank.name, rankZh: rank.chineseName, salary: rank.salary, tax: Math.round(rank.taxDiscount * 100), g: reward };
    const text = promoted
      ? tx('King of {nation} promotes {p} to {rank} ({rankZh})! Bonus: +{salary} salary, −{tax}% foreign tax. Promotion purse: {g}g.', '{nation}国王将 {p} 晋升为{rankZh}！奖励：薪俸 +{salary}，外国税金 −{tax}%。晋升赏金：{g} 金币。', params)
      : reward > 0 ? tx('King of {nation} rewards {p} with {g}g for new achievements.', '{nation}国王赏赐 {p} {g} 金币，表彰新的功绩。', params)
        : tx('{p}: the king awaits greater deeds.', '{p}：国王期待你立下更大的功绩。', params);
    const message = localize('en', text, this.state);
    if (reward) this.changeGold(player, reward, promoted ? 'promotion purse' : 'royal reward');
    this.log(text);
    const audience = { playerId: player.id, rank: player.rank, promoted, reward, message, text };
    this.state.royalAudience = audience;
    this.emit({ type: 'royalAudience', audience });
    if (this.islandsOwnedBy(player.id) > 0) this.updateCampaignMission(player.id, 'reportHome', (progress) => progress + 1);
  }

  /** Found a colony on the offered island. */
  claim(): void {
    this.assertPhase('awaitingClaim');
    const player = this.currentPlayer;
    const node = this.node(this.state.pendingClaim!);
    this.state.owners[node.id] = player.id;
    this.log(tx('{p} plants the flag on {n}!', '{p} 在{n}插上了旗帜！', { p: ref.player(player.id), n: ref.node(node.id) }));
    this.emit({ type: 'claimed', playerId: player.id, nodeId: node.id });
    this.updateCampaignMission(player.id, 'foundColony', (progress) => progress + 1);
    this.endTurn();
  }

  /** Sail on without claiming the offered island. */
  decline(): void {
    this.assertPhase('awaitingClaim');
    this.log(tx('{p} sails past {n}.', '{p} 驶过{n}。', { p: ref.player(this.currentPlayer.id), n: ref.node(this.state.pendingClaim!) }));
    this.endTurn();
  }

  recruitCaptain(index: number): void {
    this.assertPhase('awaitingRecruit');
    const id = Number.isInteger(index) ? this.state.pendingRecruits?.[index] : undefined;
    const captain = CAPTAINS.find((candidate) => candidate.id === id);
    if (!captain) throw new Error('Unknown captain offer');
    const player = this.currentPlayer;
    if (player.captains.length >= MAX_CAPTAINS) throw new Error('Crew is full');
    if (player.captains.includes(captain.id)) throw new Error('Captain already aboard');
    if (player.rank < captain.minRank) throw new Error('Higher royal rank required');
    if (player.gold < captain.fee) throw new Error('Not enough gold');
    this.changeGold(player, -captain.fee, 'captain recruitment');
    player.captains.push(captain.id);
    this.log(tx("{c} joins {p}'s fleet.", '{c} 加入了 {p} 的舰队。', { p: ref.player(player.id), c: ref.captain(captain.id) }));
    this.endTurn();
  }

  declineRecruit(): void {
    this.assertPhase('awaitingRecruit');
    this.log(tx('{p} declines captain recruitment.', '{p} 婉拒了招募船长。', { p: ref.player(this.currentPlayer.id) }));
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
    const sides = { p: ref.player(player.id), o: ref.player(owner.id), n: ref.node(node.id) };
    this.log(fromFleet ? tx("{p} opens fire on {o}'s fleet at {n}!", '{p} 在{n}向 {o} 的舰队开火！', sides)
      : tx("{p} opens fire on {o}'s docked ships at {n}!", '{p} 在{n}向 {o} 停靠的船只开火！', sides));
    const result = fightNavalBattle(player.fleet, defenders, this.rng, { attackerMultiplier: this.state.inspired ? STRATEGY_RULES.inspireMultiplier : 1 });
    this.state.inspired = false;
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
    this.log(tx('{r} rounds of cannon fire. Sunk: {p} {a}; {o} {d}.', '炮火交战 {r} 回合。被击沉：{p} {a}；{o} {d}。', { ...sides, r: result.rounds, a: ref.ships(report.attackerSunk), d: ref.ships(report.defenderSunk) }));
    switch (result.outcome) {
      case 'victory':
        this.state.owners[node.id] = player.id;
        this.log(tx('{p} sinks every defender and takes {n} from {o}!', '{p} 击沉所有守军，从 {o} 手中夺取了{n}！', sides));
        this.emit({ type: 'claimed', playerId: player.id, nodeId: node.id });
        break;
      case 'defeat':
        this.log(tx("{p}'s fleet is sunk at {n} and owes {o} double toll.", '{p} 的舰队在{n}全军覆没，须向 {o} 缴纳双倍过路费。', sides));
        report.tollPaid = this.collectToll(player, owner, node, COMBAT.defeatTollMultiplier);
        break;
      case 'draw':
        player.position = player.homePort;
        if (fromFleet) owner.position = owner.homePort;
        this.log(fromFleet ? tx('Neither side yields at {n}: {p} and {o} sail home.', '{n}之战不分胜负：{p} 与 {o} 各自归队。', sides)
          : tx('Neither side yields at {n}: {p} sail home.', '{n}之战不分胜负：{p} 归队。', sides));
        break;
    }
    this.state.battles.push(report);
    this.emit({ type: 'battleFought', report });
    if (report.outcome === 'victory') this.updateCampaignMission(player.id, 'captureColony', (progress) => progress + 1);
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
    this.log(tx('{p} barters {gq} {g} for {rq} {r} with the natives.', '{p} 用 {gq} 单位{g}向土人换得 {rq} 单位{r}。', { p: ref.player(player.id), gq: offer.giveQty, g: ref.good(offer.give), rq: offer.receiveQty, r: ref.good(offer.receive) }));
    this.emit({ type: 'barterTraded', playerId: player.id, offer });
    this.endTurn();
  }

  buyLotteryNumber(number: number): void {
    if (!this.canBuyLotteryNumber(number)) throw new Error('Cannot buy lottery number: timer, number, limit or gold');
    const lottery = this.state.lottery!;
    this.changeGold(this.currentPlayer, -LOTTERY.ticketPrice, 'lottery number');
    lottery.picks = [...lottery.picks, number].sort((a, b) => a - b);
    this.emit({ type: 'lotteryNumberBought', playerId: this.currentPlayer.id, number });
  }

  /** Run the lottery timer down; the draw happens when it reaches zero. Returns the seconds left. */
  advanceLotteryClock(seconds: number): number {
    this.assertPhase('awaitingLottery');
    const lottery = this.state.lottery!;
    if (lottery.draw) return 0;
    lottery.secondsLeft = Math.max(0, lottery.secondsLeft - Math.max(0, seconds));
    if (lottery.secondsLeft === 0) this.drawLottery();
    return lottery.secondsLeft;
  }

  /** Draw the balls from the jar (when the timer runs out, or early once the player is done buying). */
  drawLottery(): LotteryDraw {
    this.assertPhase('awaitingLottery');
    const lottery = this.state.lottery!;
    if (lottery.draw) throw new Error('Lottery already drawn');
    const player = this.currentPlayer;
    const balls = drawLotteryBalls(this.rng);
    const matches = lotteryMatches(lottery.picks, balls);
    const draw: LotteryDraw = {
      round: this.state.round, playerId: player.id, nodeId: lottery.nodeId, picks: [...lottery.picks], balls, matches,
      spent: lottery.picks.length * LOTTERY.ticketPrice, prize: LOTTERY.payouts[matches.length],
    };
    lottery.secondsLeft = 0;
    lottery.draw = draw;
    this.state.lotteryDraws.push(draw);
    this.log(tx(`Treasure Island draws {balls}. {p} holds {picks}: {m} match${matches.length === 1 ? '' : 'es'}${draw.prize ? ', winning {prize}g!' : '.'}`,
      `金银岛开奖：{balls}。{p} 持有 {picks}：中 {m} 个号码${draw.prize ? '，赢得 {prize} 金币！' : '。'}`,
      { p: ref.player(player.id), balls: ref.list(balls), picks: draw.picks.length ? ref.list(draw.picks) : tx('no numbers', '无号码'), m: matches.length, prize: draw.prize ?? 0 }));
    if (draw.prize) this.changeGold(player, draw.prize, 'lottery prize');
    this.emit({ type: 'lotteryDrawn', draw });
    return draw;
  }

  finishLottery(): void {
    this.assertPhase('awaitingLottery');
    if (!this.state.lottery?.draw) throw new Error('Lottery not drawn yet');
    this.endTurn();
  }

  challengeHermit(id: HermitId): void {
    this.assertPhase('awaitingMistDuel');
    const duel = this.state.mistDuel!;
    if (duel.hermitId !== null || !HERMITS.some((hermit) => hermit.id === id)) {
      throw new Error('Cannot challenge this hermit');
    }
    duel.hermitId = id;
    this.emit({ type: 'mistDuelUpdated', playerId: this.currentPlayer.id });
  }

  takeMistStones(count: number): void {
    if (!this.canTakeMistStones(count)) throw new Error('Cannot take that many stones');
    const duel = this.state.mistDuel!;
    const player = this.currentPlayer;
    const hermit = HERMITS.find((candidate) => candidate.id === duel.hermitId)!;
    duel.stonesLeft -= count;
    const hermitTake = duel.stonesLeft ? hermitStoneTake(hermit.id, duel.stonesLeft) : null;
    duel.stonesLeft -= hermitTake ?? 0;
    duel.lastTurn = { playerTake: count, hermitTake };
    if (duel.stonesLeft > 0) {
      this.emit({ type: 'mistDuelUpdated', playerId: player.id });
      return;
    }

    const won = hermitTake !== null;
    this.log(won ? tx('{p} wins the Mist Island duel: {h} takes the last stone.', '{p} 赢得迷雾岛对决：{h} 拿走了最后一枚棋子。', { p: ref.player(player.id), h: ref.hermit(hermit.id) })
      : tx('{p} loses the Mist Island duel to {h} by taking the last stone.', '{p} 拿走了最后一枚棋子，输给了{h}。', { p: ref.player(player.id), h: ref.hermit(hermit.id) }));
    let strategy: StrategyId | null = null;
    if (won) {
      this.changeGold(player, SEA_RULES.nimPrize, 'Nim prize');
      if (this.gainStrategy(player.id, 'hermit Nim', hermit.reward)) strategy = hermit.reward;
    }
    const result: MistResult = {
      round: this.state.round, playerId: player.id, nodeId: duel.nodeId, hermitId: hermit.id,
      outcome: won ? 'win' : 'loss', strategy,
    };
    duel.result = result;
    this.state.mistResults.push(result);
    this.emit({ type: 'mistDuelResolved', result });
  }

  leaveMistIsland(): void {
    if (!this.canLeaveMistIsland()) throw new Error('Cannot leave an active Mist Island duel');
    if (!this.state.mistDuel!.result) this.log(tx('{p} declines the Mist Island challenge.', '{p} 婉拒了迷雾岛的挑战。', { p: ref.player(this.currentPlayer.id) }));
    this.endTurn();
  }

  declineBarter(): void {
    this.assertPhase('awaitingBarter');
    this.log(tx('{p} declines native barter.', '{p} 婉拒了与土人交换。', { p: ref.player(this.currentPlayer.id) }));
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
    const moved = { p: ref.player(player.id), s: ref.ship(ship.name), n: ref.node(nodeId) };
    this.log(direction === 'dock' ? tx('{p} docks {s} at {n}.', '{p} 将{s}停靠在{n}。', moved) : tx('{p} boards {s} at {n}.', '{p} 在{n}让{s}归队。', moved));
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
    const moved = { p: ref.player(player.id), q: qty, g: ref.good(good), s: ref.ship(ship.name) };
    this.log(direction === 'load' ? tx('{p} loads {q} {g} onto {s}.', '{p} 将 {q} 单位{g}装上{s}。', moved) : tx('{p} unloads {q} {g} from {s}.', '{p} 从{s}卸下 {q} 单位{g}。', moved));
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
    this.log(tx('AUTO loaded {n} specialty units.', '自动装载了 {n} 单位特产。', { n: total }));
    return total;
  }

  build(kind: BuildingKind): void {
    this.assertPhase('awaitingBuild');
    if (!this.canBuild(kind)) throw new Error('Cannot build here: ownership, cost or maximum level');
    const player = this.currentPlayer;
    const nodeId = player.position;
    const level = buildingLevel(this.state, nodeId, kind) + 1;
    this.changeGold(player, -nextBuildingCost(this.state, nodeId, kind)!, BUILDINGS[kind].label);
    this.state.buildings[nodeId][kind] = level;
    this.log(tx('{p} builds {b} level {l} at {n}.', '{p} 在{n}建造了 {l} 级{b}。', { p: ref.player(player.id), b: ref.building(kind), l: level, n: ref.node(nodeId) }));
    this.emit({ type: 'buildingBuilt', playerId: player.id, nodeId, kind, level });
    if (kind === 'collectionField') this.updateCampaignMission(player.id, 'buildCollectionField', (progress) => progress + 1);
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
    const trade = { p: ref.player(player.id), q: quantity, g: ref.good(good), t: total };
    this.log(buying ? tx('{p} buys {q} {g} for {t}g at Nightless Island.', '{p} 在不夜岛以 {t} 金币买入 {q} 单位{g}。', trade) : tx('{p} sells {q} {g} for {t}g at Nightless Island.', '{p} 在不夜岛以 {t} 金币卖出 {q} 单位{g}。', trade));
    this.emit({ ...order, type: 'marketTrade', playerId: player.id, total });
    if (!buying && good !== 'lumber' && good !== 'iron') {
      this.updateCampaignMission(player.id, 'sellSpecialties', (progress) => progress + quantity);
    }
  }

  finishTrading(): void {
    this.assertPhase('awaitingCargoMarket');
    this.endTurn();
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
    this.log(tx('{p} launches {s} at {n}.', '{p} 在{n}让{s}下水。', { p: ref.player(player.id), s: ref.ship(ship.name), n: ref.node(node.id) }));
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
    if (this.state.phase === 'awaitingSpin') {
      const p = this.currentPlayer;
      if (this.canUseStrategy('navigate', p.position)) {
        const target = aiTravelTarget(this.state, p);
        if (target !== undefined) { this.useStrategy('navigate', target); return; }
      }
      if (p.knownHoard === null && this.canUseStrategy('locate')) this.useStrategy('locate');
    }
    if (this.state.phase === 'awaitingToll') {
      const card = aiBattleStrategy(this.state, this.currentPlayer, (id) => this.canUseStrategy(id));
      if (card) this.useStrategy(card);
      if (aiShouldFight(this.state, this.currentPlayer)) this.fight();
      else this.payToll();
      return;
    }
    if (this.state.phase === 'awaitingMarket') {
      const player = this.currentPlayer;
      const sale = aiUsedShipSale(this.state, player, (id) => this.canSellShip(id));
      if (sale !== undefined) this.sellShip(sale);
      const purchase = aiUsedShipChoice(this.state, player, (type) => this.canBuyUsedShip(type));
      if (purchase) this.buyUsedShip(purchase);
      this.finishMarket();
      return;
    }
    if (this.state.phase === 'awaitingRecruit') {
      const choice = aiRecruitChoice(this.currentPlayer, this.state.pendingRecruits!);
      if (choice === null) this.declineRecruit();
      else this.recruitCaptain(choice);
      return;
    }
    if (this.state.phase === 'awaitingBarter') {
      const choice = aiBarterChoice(this.currentPlayer, this.state.pendingBarter!);
      if (choice === null) this.declineBarter();
      else this.acceptBarter(choice);
      return;
    }
    if (this.state.phase === 'awaitingLottery') {
      const lottery = this.state.lottery!;
      if (!lottery.draw) {
        let picks = aiLotteryPickCount(this.currentPlayer.gold);
        while (picks-- > 0) {
          const open = Array.from({ length: LOTTERY.balls }, (_, i) => i + 1).filter((n) => !lottery.picks.includes(n));
          this.buyLotteryNumber(open[Math.floor(this.rng() * open.length)]);
        }
        this.drawLottery();
      }
      this.finishLottery();
      return;
    }
    if (this.state.phase === 'awaitingMistDuel') {
      const duel = this.state.mistDuel!;
      const hard = this.currentPlayer.aiDifficulty === 'hard';
      if (!duel.hermitId) this.challengeHermit(hard ? 'brook' : HERMITS[Math.floor(this.rng() * HERMITS.length)].id);
      while (!duel.result) {
        const take = hard ? aiMistTake(duel.hermitId!, duel.stonesLeft) || 1 : 1 + Math.floor(this.rng() * Math.min(NIM_MAX_TAKE, duel.stonesLeft));
        this.takeMistStones(take);
      }
      this.leaveMistIsland();
      return;
    }
    if (this.state.phase === 'awaitingBuild') {
      const player = this.currentPlayer;
      let kind = aiBuildingChoice(this.state, this.currentPlayer);
      while (kind !== null && this.canBuild(kind)) {
        this.build(kind);
        kind = aiBuildingChoice(this.state, this.currentPlayer);
      }
      for (const ship of [...this.state.docks[player.position]]) {
        if (ship.durability === ship.maxDurability || !buildingLevel(this.state, player.position, 'repairYard')) this.boardShip(ship.id);
      }
      const ship = aiShipChoice(player, (type) => this.canBuildShip(type));
      if (ship) this.buildShip(ship);
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
      const purchase = aiMarketPurchase(this.state, this.currentPlayer);
      if (purchase) this.tradeAtMarket(purchase);
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

  buyUsedShip(type: ShipType): Ship {
    if (!this.canBuyUsedShip(type)) throw new Error('Cannot buy ship: market, stock or gold');
    this.state.marketStock.splice(this.state.marketStock.indexOf(type), 1);
    this.changeGold(this.currentPlayer, -USED_SHIP_PRICES[type], 'second-hand ship');
    const ship = this.addShipToFleet(this.currentPlayer.id, type);
    ship.durability = Math.floor(ship.maxDurability * USED_SHIP_CONDITION);
    this.log(tx('{p} buys {s} at Skeleton Island.', '{p} 在骷髅岛买下{s}。', { p: ref.player(this.currentPlayer.id), s: ref.ship(ship.name) }));
    return ship;
  }

  sellShip(shipId: number): void {
    if (!this.canSellShip(shipId)) throw new Error('Cannot sell ship: market, last ship, ownership or cargo');
    const fleet = this.currentPlayer.fleet;
    const [ship] = fleet.splice(fleet.findIndex((ship) => ship.id === shipId), 1);
    const price = shipSalePrice(ship);
    this.changeGold(this.currentPlayer, price, 'ship sale');
    this.emit({ type: 'shipSold', playerId: this.currentPlayer.id, shipName: ship.name, price });
    this.log(tx('{p} sells {s} at Skeleton Island.', '{p} 在骷髅岛卖出{s}。', { p: ref.player(this.currentPlayer.id), s: ref.ship(ship.name) }));
  }

  finishMarket(): void {
    if (!this.atMarket()) throw new Error('Not at Skeleton Island market');
    this.state.marketStock = [];
    this.endTurn();
  }

  leaveRevivalIsland(): void {
    this.assertPhase('awaitingRevival');
    this.endTurn();
  }

  private resolveSpecial(player: Player, node: MapNode): void {
    const r = SEA_RULES;
    this.log(tx('{p} visits {n}.', '{p} 造访{n}。', { p: ref.player(player.id), n: ref.node(node.id) }));
    switch (node.special) {
      case 'skeleton':
        if (player.gold >= r.tribute) {
          this.log(tx('The pirates demand tribute from {p} at their second-hand ship market.', '海盗在二手船市场向 {p} 索取贡金。', { p: ref.player(player.id) }));
          this.changeGold(player, -r.tribute, 'pirate tribute');
        } else {
          this.log(tx("The pirates buy {p}'s scrap ship fittings.", '海盗收购了 {p} 的废旧船具。', { p: ref.player(player.id) }));
          this.changeGold(player, r.scrap, 'scrap sale');
        }
        break;
      case 'treasure':
        if (player.gold < LOTTERY.ticketPrice) { this.log(tx('{p} cannot afford a lottery number.', '{p} 买不起彩票号码。', { p: ref.player(player.id) })); break; }
        this.state.lottery = { playerId: player.id, nodeId: node.id, picks: [], secondsLeft: LOTTERY.timerSeconds, draw: null };
        this.state.phase = 'awaitingLottery';
        this.log(tx('{p} may buy lottery numbers at {price}g each before the draw in {s}s.', '{p} 可在 {s} 秒后开奖前购买彩票号码，每个 {price} 金币。', { p: ref.player(player.id), price: LOTTERY.ticketPrice, s: LOTTERY.timerSeconds }));
        this.emit({ type: 'lotteryOpened', playerId: player.id, nodeId: node.id });
        break;
      case 'mist':
        this.state.mistDuel = { nodeId: node.id, hermitId: null, stonesLeft: r.nimStones, lastTurn: null, result: null };
        this.state.phase = 'awaitingMistDuel';
        this.emit({ type: 'mistOffered', playerId: player.id, nodeId: node.id });
        break;
      case 'revival': {
        const damage = player.fleet.reduce((sum, ship) => sum + ship.maxDurability - ship.durability, 0);
        const points = damage;
        const goldSpent = 0;
        let remaining = points;
        for (const ship of player.fleet) {
          const repaired = Math.min(remaining, ship.maxDurability - ship.durability);
          ship.durability += repaired;
          remaining -= repaired;
        }
        if (damage === 0) this.log(tx("{p}'s fleet already sound: no repair fee.", '{p} 的舰队完好无损：无需修理费。', { p: ref.player(player.id) }));
        else {
          this.log(tx("Revival repairs {p}'s fleet: restored {pts}/{dmg} durability free of charge. Fleet fully repaired.",
            '复活岛修理了 {p} 的舰队：免费恢复 {pts}/{dmg} 耐久。舰队已全部修复。',
            { p: ref.player(player.id), pts: points, dmg: damage, g: goldSpent }));
        }
        player.revivalProtection = false;
        if (!player.isAI) {
          this.state.revivalReport = { damage, restored: points, goldSpent };
          this.state.phase = 'awaitingRevival';
          this.emit({ type: 'revivalReportReady', playerId: player.id });
        }
        break;
      }
      case 'wind': {
        const offers = barterOffers(player, this.rng);
        if (!offers.length) {
          this.log(tx("The natives have no use for {p}'s cargo. No barter today.", '土人用不上 {p} 的货物，今天无法交换。', { p: ref.player(player.id) }));
          break;
        }
        this.state.pendingBarter = offers;
        this.state.phase = 'awaitingBarter';
        this.emit({ type: 'barterOffered', playerId: player.id, nodeId: node.id });
        break;
      }
      case 'dragonSnake': {
        if (player.captains.length >= MAX_CAPTAINS) {
          this.log(tx("{p}'s crew is full. No more captains can join.", '{p} 的船员已满，无法再招募船长。', { p: ref.player(player.id) }));
          break;
        }
        const offers = recruitOffers(player, this.rng);
        if (!offers.some((id) => CAPTAINS.find((captain) => captain.id === id)!.fee <= player.gold)) {
          this.log(tx('{p} finds no affordable captains available to recruit.', '{p} 找不到雇得起的船长。', { p: ref.player(player.id) }));
          break;
        }
        this.state.pendingRecruits = offers;
        this.state.phase = 'awaitingRecruit';
        this.log(tx('{p} talks to sailors at Dragon Snake Island.', '{p} 在龙蛇岛与水手们交谈。', { p: ref.player(player.id) }));
        this.emit({ type: 'recruitsOffered', playerId: player.id, nodeId: node.id });
        break;
      }
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
        if (this.rng() < STRATEGY_RULES.bottleChance) this.gainStrategy(player.id, 'drifting bottle');
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
        const direction = this.rng() < 0.5 ? -1 : 1;
        const path = walkPath(this.state.map, player.position, direction * SEA_RULES.whirlpoolSteps, this.state.wind.direction);
        player.position = path[path.length - 1];
        this.pendingPath = path;
        announce('relocated', { destination: player.position });
        this.emit({ type: 'moved', playerId: player.id, path });
        return true;
      }
      case 'treasure': {
        if (node.id === this.state.hoardNode) {
          this.changeGold(player, STRATEGY_RULES.hoardGold, 'buried hoard');
          this.log(tx('{p} digs up the buried hoard: {g}g!', '{p} 挖出了埋藏的宝藏：{g} 金币！', { p: ref.player(player.id), g: STRATEGY_RULES.hoardGold }));
          for (const p of this.state.players) p.knownHoard = null;
          this.buryHoard(node.id);
        }
        const { min, max, step } = EVENT_GOLD.treasure;
        const amount = min + Math.floor(this.rng() * ((max - min) / step + 1)) * step;
        this.log(tx('{p} hauls up a sunken chest worth {g}g!', '{p} 打捞起价值 {g} 金币的沉箱！', { p: ref.player(player.id), g: amount }));
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
        this.log(tx("A storm batters {p}'s fleet: repairs cost {g}g.", '风暴重创 {p} 的舰队：修理花费 {g} 金币。', { p: ref.player(player.id), g: amount }));
        this.changeGold(player, -amount, 'storm repairs');
        announce('damaged', { gold: -amount, damage: stormDamage });
        break;
      }
      case 'tradeWind': {
        for (const good of GOODS) this.state.market.stock[good] += 3;
        const amount = EVENT_GOLD.tradeWind.perColony * this.islandsOwnedBy(player.id) + EVENT_GOLD.tradeWind.base;
        this.log(tx("Trade winds carry {p}'s goods to market: +{g}g.", '信风把 {p} 的货物送到市场：+{g} 金币。', { p: ref.player(player.id), g: amount }));
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
    const amount = Math.min(toll, Math.max(player.gold, 0));
    const toll_ = { p: ref.player(player.id), g: amount, o: ref.player(owner.id), n: ref.node(node.id) };
    this.log(multiplier > 1 ? tx('{p} pays {g}g double toll to {o} at {n}.', '{p} 在{n}向 {o} 缴纳 {g} 金币双倍过路费。', toll_) : tx('{p} pays {g}g toll to {o} at {n}.', '{p} 在{n}向 {o} 缴纳 {g} 金币过路费。', toll_));
    this.changeGold(player, -toll, `toll at ${node.name}`);
    this.changeGold(owner, amount, `toll at ${node.name}`);
    this.emit({ type: 'tollPaid', from: player.id, to: owner.id, amount });
    return amount;
  }

  private payForeignTax(player: Player, host: Player | undefined, node: MapNode): void {
    const tax = discountedByCaptains(player, 'tax', foreignTaxDue(player.rank));
    const paid = Math.min(player.gold, tax);
    let shortfall = tax - paid;
    this.log(tx('{p} pays {g}g foreign tax to {h} at {n} ({t}g due).', '{p} 在{n}向 {h} 缴纳 {g} 金币外国税金（应缴 {t} 金币）。', { p: ref.player(player.id), g: paid, h: host ? ref.player(host.id) : tx('the crown', '王室'), n: ref.node(node.id), t: tax }));
    this.changeGold(player, -paid, 'foreign tax');
    if (host) this.changeGold(host, paid, 'foreign tax');
    const cheapestFirst = [...player.fleet].sort((a, b) => shipSalePrice(a) - shipSalePrice(b) || a.id - b.id);
    for (const ship of cheapestFirst) {
      if (shortfall <= 0) break;
      const value = shipSalePrice(ship);
      player.fleet.splice(player.fleet.indexOf(ship), 1);
      if (host) host.fleet.push(ship);
      shortfall -= value;
      this.log(tx("{p}'s {s} is seized by {h} for {v}g toward foreign tax.", '{p} 的{s}被 {h} 扣押，抵税 {v} 金币。', { p: ref.player(player.id), s: ref.ship(ship.name), h: host ? ref.player(host.id) : tx('the crown', '王室'), v: value }));
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
      this.log(tx('{p} is bankrupt! Their colonies fall back to neutral.', '{p} 破产了！其殖民地全部恢复中立。', { p: ref.player(player.id) }));
      this.emit({ type: 'bankrupt', playerId: player.id });
    }
  }

  private endTurn(): void {
    if (--this.state.wind.turnsLeft === 0) {
      const choices = WIND_DIRECTIONS.filter((d) => d !== this.state.wind.direction);
      const direction = choices[Math.floor(this.rng() * choices.length)];
      this.state.wind = { direction, turnsLeft: 2 + Math.floor(this.rng() * 3) };
      const en = { N: 'North', E: 'East', S: 'South', W: 'West' }[direction];
      const zh = { N: '北风', E: '东风', S: '南风', W: '西风' }[direction];
      const turns = this.state.wind.turnsLeft === 1 ? 'turn' : 'turns';
      this.log(tx(`${en} wind rises. Changes in {n} ${turns}.`, `${zh}起，{n} 个回合后转向。`, { n: this.state.wind.turnsLeft }));
      this.emit({ type: 'windChanged', ...this.state.wind });
    }
    this.state.pendingMerchant = null;
    this.state.pendingWyvern = false;
    this.state.pendingClaim = null;
    this.state.pendingBarter = null;
    this.state.lottery = null;
    this.state.mistDuel = null;
    this.state.revivalReport = null;
    this.state.pendingRecruits = null;
    if (this.checkVictory()) return;

    const lastPosition = turnOrderPosition(this.state, this.state.currentPlayer);
    let next = this.nextActivePlayer(lastPosition + 1);
    if (next === undefined) {
      this.produceColonyGoods();
      advanceMarket(this.state.market);
      this.state.round += 1;
      if (this.checkVictory()) return;
      this.log(tx('Round {r} begins.', '第 {r} 回合开始。', { r: this.state.round }));
      next = this.nextActivePlayer(0)!;
    }

    this.state.currentPlayer = next;
    this.state.lastSpin = null;
    this.state.strategyUsed = false;
    this.state.inspired = false;
    this.state.phase = 'awaitingSpin';
    this.repairDockedShips();
    this.emit({ type: 'turnStarted', playerId: next });
  }

  private damageFleet(player: Player): void {
    for (const ship of player.fleet) {
      ship.durability = Math.max(0, ship.durability - SEA_HAZARD_DAMAGE);
    }
    this.log(tx("{p}'s ships each lose up to {d} durability (minimum 0; ships are not sunk).", '{p} 的每艘船最多损失 {d} 点耐久（最低为 0，不会沉没）。', { p: ref.player(player.id), d: SEA_HAZARD_DAMAGE }));
  }

  private repairDockedShips(): void {
    for (const node of this.state.map) {
      if (this.state.owners[node.id] !== this.currentPlayer.id || !buildingLevel(this.state, node.id, 'repairYard')) continue;
      let repaired = 0;
      for (const ship of this.state.docks[node.id]) {
        repaired += ship.maxDurability - ship.durability;
        ship.durability = ship.maxDurability;
      }
      if (repaired > 0) this.log(tx("{p}'s repair yard at {n} restores {r} docked ship durability for free.", '{p} 在{n}的修船厂免费为停靠的船只恢复 {r} 点耐久。', { p: ref.player(this.currentPlayer.id), n: ref.node(node.id), r: repaired }));
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
    if (this.state.campaign) return this.checkCampaignResult(this.state.campaign);

    const { players, config } = this.state;
    const alive = players.filter((p) => !p.bankrupt);
    let winner: Player | undefined;
    let victory: VictoryKind | undefined;
    let reason: Text = tx('', '');

    const conqueror = alive.find((p) => this.islandsOwnedBy(p.id) >= config.islandsToWin);
    if (conqueror) {
      winner = conqueror;
      const islandCount = this.state.map.filter((node) => node.kind === 'island').length;
      victory = config.islandsToWin >= islandCount ? 'everyContinent' : 'islandGoal';
      reason = victory === 'everyContinent'
        ? tx('holds all {n} new continents for the crown', '为王室占领了全部 {n} 块新大陆', { n: islandCount })
        : tx('claimed {n} islands for the crown', '为王室占领了 {n} 座岛屿', { n: config.islandsToWin });
    } else if (players.length > 1 && alive.length === 1) {
      winner = alive[0];
      victory = 'lastAfloat';
      reason = tx('is the last navigator afloat', '是最后一位仍在海上的航海家');
    } else if (alive.length === 0) {
      winner = players[0];
      victory = 'lastAfloat';
      reason = tx('outlasted the sea', '比大海撑得更久');
    } else if (hasRoundLimit(config) && this.state.round > config.maxRounds) {
      winner = alive.reduce((a, b) => (this.netWorth(b.id) > this.netWorth(a.id) ? b : a));
      victory = 'richest';
      reason = tx('is the richest navigator after {n} rounds', '在 {n} 回合后成为最富有的航海家', { n: config.maxRounds });
    }

    if (!winner || !victory) return false;
    this.finishGame(winner, victory, reason);
    return true;
  }

  private updateCampaignMission(playerId: number, objective: CampaignObjective, update: (progress: number) => number): void {
    const campaign = this.state.campaign;
    if (!campaign || campaign.status !== 'active' || campaign.playerId !== playerId || this.state.players[playerId].bankrupt) return;
    const mission = campaignStage(campaign.stage).missions.find((candidate) => candidate.objective === objective);
    const progress = campaign.progress[objective] ?? 0;
    if (!mission || progress >= mission.target) return;
    const next = Math.min(mission.target, update(progress));
    campaign.progress[objective] = next;
    if (next === mission.target) {
      this.changeGold(this.state.players[playerId], mission.reward, 'king’s mission');
      this.log(tx('King’s mission complete: {m}. The crown awards {g}g.', '国王使命完成：{m}。王室奖励 {g} 金币。', { m: ref.mission(campaign.stage, mission.objective), g: mission.reward }));
      this.emit({ type: 'campaignMissionCompleted', playerId, mission });
    }
  }

  private checkCampaignResult(campaign: CampaignState): boolean {
    const player = this.state.players[campaign.playerId];
    const stage = campaignStage(campaign.stage);
    const { config, round } = this.state;
    const expired = hasRoundLimit(config) && round > config.maxRounds;
    if (player.bankrupt || expired) {
      const reasonText = player.bankrupt ? tx('Your navigator went bankrupt.', '你的航海家破产了。') : tx('The {r}-round deadline passed.', '{r} 回合期限已过。', { r: config.maxRounds });
      const reason = localize('en', reasonText, this.state);
      campaign.status = 'failed';
      this.state.phase = 'gameOver';
      this.log(reasonText);
      this.emit({ type: 'campaignFailed', playerId: player.id, reason });
      return true;
    }
    this.updateCampaignMission(player.id, 'holdColonies', () => this.islandsOwnedBy(player.id));
    if (!stage.missions.every((mission) => (campaign.progress[mission.objective] ?? 0) >= mission.target)) return false;
    campaign.status = 'completed';
    this.finishGame(player, 'campaign', tx('completes {s} for the crown', '为王室完成了「{s}」', { s: ref.stage(stage.id) }));
    return true;
  }

  private finishGame(winner: Player, victory: VictoryKind, reason: Text): void {
    this.state.phase = 'gameOver';
    this.state.winner = winner.id;
    this.state.victory = victory;
    this.log(tx('{w} {r}!', '{w} {r}！', { w: ref.player(winner.id), r: reason }));
    this.emit({ type: 'gameOver', winner: winner.id, victory, reason: localize('en', reason, this.state) });
  }

  private node(id: number): MapNode {
    return this.state.map[id];
  }

  private log(text: Text): void {
    const message = localize('en', text, this.state);
    this.state.log.push(message);
    (this.state.logText ??= []).push(text);
    this.emit({ type: 'log', message, text });
  }

  private assertPhase(phase: GameState['phase']): void {
    if (this.state.phase !== phase) {
      throw new Error(`Expected phase ${phase}, but the game is in ${this.state.phase}`);
    }
  }

  private emit(event: GameEvent): void {
    if (event.type === 'seaEvent') {
      this.log(tx('{p}: {e}', '{p}：{e}', { p: ref.player(event.playerId), e: seaEventTx(event, event.destination === undefined ? undefined : ref.node(event.destination)) }));
    }
    if (event.type === 'merchantOffered') {
      const { good, quantity, gold } = event.offer;
      this.log(tx('A merchant offers {p} {g}g for {q} aboard {good}.', '商船出价 {g} 金币，收购 {p} 船上的 {q} 单位{good}。', { p: ref.player(event.playerId), g: gold, q: quantity, good: ref.good(good) }));
    }
    if (event.type === 'wyvernOffered') this.log(tx('A wyvern offers to carry {p} to any destination.', '翼龙愿意载 {p} 飞往任意地点。', { p: ref.player(event.playerId) }));
    for (const listener of this.listeners) listener(event, this.state);
  }
}
