/**
 * Core data types shared by the client (single-player today) and the server
 * (authoritative multiplayer later). Keep these plain, serialisable objects so
 * a whole GameState can be sent over the network or saved to a database.
 */

/** What a stop on the sea route does when a fleet lands on it. */
export type NodeKind = 'port' | 'island' | 'event' | 'special' | 'sea';
export type SpecialKind = 'skeleton' | 'treasure' | 'mist' | 'revival' | 'nightless' | 'wind' | 'dragonSnake';

/** Random-event stops (the "joy core" of the original game). */
export type EventKind = 'openSea' | 'treasure' | 'storm' | 'tradeWind' | 'pirates' | 'smallMonster' | 'largeMonster' | 'turtle' | 'whirlpool' | 'bottle' | 'floatingCargo' | 'merchant' | 'wyvern';

/** One stop on the node-based sea route. */
export interface MapNode {
  next?: number[];
  id: number;
  name: string;
  kind: NodeKind;
  special?: SpecialKind;
  chineseName?: string;
  nation?: string;
  /** World position in pixels; also determines exit headings. */
  x: number;
  y: number;
  /** Islands only: cost to found a colony. */
  price?: number;
  /** Islands only: toll a rival pays when landing on the colony. */
  toll?: number;
  /** Islands only: the local specialty produced by a collection field. */
  specialty?: Specialty;
  /** Islands only: units of iron produced per round per mine level (default 1). */
  ironYield?: number;
  /** Event stops only. */
  event?: EventKind;
}

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface PlayerSetup {
  retreatThreshold?: import('./withdrawal').RetreatThreshold;
  name: string;
  nation?: string;
  /** Historical navigator id (see NAVIGATORS); their signature ship replaces the starting ship of its type. */
  navigator?: string;
  /** 0xRRGGBB, used for the ship token and colony flags. */
  color: number;
  isAI: boolean;
  /** Rival policy only; all seats use the same economy and rules. Defaults to Normal. */
  aiDifficulty?: AIDifficulty;
}

export type ShipType = 'warship' | 'cargo' | 'explorer';

export interface ShipStats {
  maxDurability: number;
  firepower: number;
  cargoCapacity: number;
  speed: number;
  crewCapacity: number;
}

export interface Ship extends ShipStats {
  cargo: Partial<Record<Good, number>>;
  id: number;
  name: string;
  type: ShipType;
  durability: number;
  /** The navigator's signature flagship. */
  signature?: boolean;
}

export interface Player extends PlayerSetup {
  strategies: import('./strategies').StrategyId[];
  knownHoard: number | null;
  rank: number;
  audienceMerit: number;
  id: number;
  gold: number;
  /** Index of the map node the fleet is on. */
  position: number;
  bankrupt: boolean;
  fleetLost?: true;
  nextColonyReturnRound?: number;
  homePort: number;
  revivalProtection: boolean;
  escortProtection: boolean;
  skipNextTurn: boolean;
  captains: string[];
  fleet: Ship[];
  reservedShips?: Ship[];
}

export type BuildingKind = 'lumberMill' | 'ironMine' | 'shipyard' | 'repairYard' | 'collectionField' | 'fort';
export type Specialty = 'Wine' | 'Sugar' | 'Cotton' | 'Timber' | 'Cocoa' | 'Tobacco' | 'Silver' | 'Spices' | 'Silk' | 'Tea';
export type Good = 'lumber' | 'iron' | Specialty;

export interface ColonyStockpile {
  lumber: number;
  iron: number;
  specialties: Partial<Record<Specialty, number>>;
}

export type Phase = 'awaitingSpin' | 'spinning' | 'moving' | 'awaitingClaim' | 'awaitingBuild' |
  'awaitingMarket' | 'awaitingRecruit' | 'awaitingLottery' | 'awaitingBarter' | 'awaitingMistDuel' |
  'awaitingMerchant' | 'awaitingSalvage' | 'awaitingWyvern' | 'awaitingCargoMarket' | 'awaitingRevival' | 'awaitingToll' | 'awaitingBattle' | 'gameOver';

export interface RevivalReport {
  damage: number;
  restored: number;
  goldSpent: number;
}

export interface MerchantOffer {
  stock?: { good: Specialty; quantity: number; unitPrice: number };
  good: Specialty;
  quantity: number;
  gold: number;
}

export interface SeaEventResult {
  type: 'seaEvent';
  playerId: number;
  event: EventKind;
  outcome: 'protected' | 'victory' | 'defeat' | 'damaged' | 'sunk' | 'gold' | 'specialPrize' | 'repaired' | 'cargo' | 'accepted' | 'declined' | 'noTrade' | 'relocated' | 'escaped';
  gold?: number;
  salvageFee?: number;
  shipsLost?: number[];
  damage?: number;
  good?: Specialty;
  quantity?: number;
  destination?: number;
}

export interface MarketState {
  stock: Record<Good, number>;
  repairDemandThroughRound: number;
}

export interface MarketOrder {
  side: 'buy' | 'sell';
  shipId: number;
  good: Good;
  quantity: number;
}

export interface BarterOffer {
  give: Good;
  giveQty: number;
  receive: Good;
  receiveQty: number;
}

/** everyContinent: held every new continent at once (the original's victory); islandGoal: reached a shorter mode's island target. */
export type VictoryKind = 'everyContinent' | 'islandGoal' | 'lastAfloat' | 'richest' | 'campaign';

export type BattleOutcome = 'victory' | 'defeat' | 'draw';

/** The record of one naval battle at a rival colony. */
export interface BattleReport {
  nodeId: number;
  attacker: number;
  defender: number;
  outcome: BattleOutcome;
  rounds: number;
  attackerSunk: string[];
  defenderSunk: string[];
  /** Shore forts destroyed out of those defending the colony. */
  fortsDestroyed?: number;
  forts?: number;
  /** Double toll paid after a defeat; 0 otherwise. */
  tollPaid: number;
}

export interface GameConfig {
  battleMode: 'realtime' | 'auto';
  startingStrategies: number;
  startingGold: number;
  /** Paid by the crown every time a fleet passes or lands on the home port. */
  homeSalary: number;
  /** Holding this many islands at once wins; capped at the map's island count, so the default means every new continent. */
  islandsToWin: number;
  /** After this many rounds the richest navigator wins (NO_ROUND_LIMIT disables it). */
  maxRounds: number;
}

export type WindDirection = 'N' | 'E' | 'S' | 'W';

export interface GameState {
  pendingBattle: PendingBattle | null;
  roamers: { id: number; kind: 'pirates' | 'smallMonster'; node: number }[];
  wind: { direction: WindDirection; turnsLeft: number };
  hoardNode: number | null;
  strategyUsed: boolean;
  inspired: boolean;
  ambush: boolean;
  compassMultiplier: number;
  royalAudience: import('./ranks').RoyalAudience | null;
  campaign: import('./campaign').CampaignState | null;
  config: GameConfig;
  map: MapNode[];
  players: Player[];
  nextShipId: number;
  marketStock: ShipType[];
  /** owners[nodeId] = owning player id, or null when neutral / not an island. */
  owners: (number | null)[];
  buildings: Partial<Record<BuildingKind, number>>[];
  stockpiles: ColonyStockpile[];
  docks: Ship[][];
  market: MarketState;
  /** Units of the local specialty for sale, indexed by island. */
  colonyMarketStock: number[];
  currentPlayer: number;
  round: number;
  phase: Phase;
  lastSpin: number | null;
  /** Island the current player may claim while phase === 'awaitingClaim'. */
  pendingClaim: number | null;
  pendingBarter: BarterOffer[] | null;
  pendingMerchant: MerchantOffer | null;
  salvageFee: number | null;
  pendingWyvern: boolean;
  /** Treasure Island lottery the current player is playing, while phase === 'awaitingLottery'. */
  lottery: import('./lottery').LotteryState | null;
  /** Every Treasure Island draw this game, oldest first. */
  lotteryDraws: import('./lottery').LotteryDraw[];
  mistDuel: import('./mist').MistDuel | null;
  mistResults: import('./mist').MistResult[];
  revivalReport: RevivalReport | null;
  pendingRecruits: string[] | null;
  /** Every naval battle fought this game, oldest first. */
  battles: BattleReport[];
  winner: number | null;
  /** How the winner won, once phase === 'gameOver'. */
  victory: VictoryKind | null;
  log: string[];
  /** The same entries as `log`, in every language (absent in saves from before localisation). */
  logText?: import('./i18n').Text[];
}

/** Everything the engine announces; renderers and the network layer subscribe. */
export type GameEvent =
  | { type: 'battleStarted'; battle: PendingBattle }
  | { type: 'windChanged'; direction: WindDirection; turnsLeft: number }
  | SeaEventResult
  | { type: 'merchantOffered'; playerId: number; offer: MerchantOffer }
  | { type: 'salvageOffered'; playerId: number }
  | { type: 'wyvernOffered'; playerId: number }
  | { type: 'strategyGained'; playerId: number; card: import('./strategies').StrategyId; source: string }
  | { type: 'strategyUsed'; playerId: number; card: import('./strategies').StrategyId; target?: number }
  | { type: 'royalAudience'; audience: import('./ranks').RoyalAudience }
  | { type: 'campaignMissionCompleted'; playerId: number; mission: import('./campaign').CampaignMission }
  | { type: 'campaignFailed'; playerId: number; reason: string }
  | { type: 'shipSold'; playerId: number; shipName: string; price: number }
  | { type: 'marketOffered'; playerId: number; nodeId: number }
  | { type: 'barterOffered'; playerId: number; nodeId: number }
  | { type: 'lotteryOpened'; playerId: number; nodeId: number }
  | { type: 'lotteryNumberBought'; playerId: number; number: number }
  | { type: 'lotteryDrawn'; draw: import('./lottery').LotteryDraw }
  | { type: 'mistOffered'; playerId: number; nodeId: number }
  | { type: 'mistDuelUpdated'; playerId: number }
  | { type: 'mistDuelResolved'; result: import('./mist').MistResult }
  | { type: 'revivalReportReady'; playerId: number }
  | { type: 'recruitsOffered'; playerId: number; nodeId: number }
  | { type: 'shipTransferred'; playerId: number; nodeId: number; shipId: number; direction: 'dock' | 'board' }
  | { type: 'cargoMoved'; playerId: number; nodeId: number; shipId: number; good: Good; qty: number; direction: 'load' | 'unload' }
  | { type: 'buildingBuilt'; playerId: number; nodeId: number; kind: BuildingKind; level: number }
  | { type: 'buildOffered'; playerId: number; nodeId: number }
  | { type: 'barterTraded'; playerId: number; offer: BarterOffer }
  | { type: 'cargoMarketOpened'; playerId: number; nodeId: number }
  | ({ type: 'marketTrade'; playerId: number; total: number } & MarketOrder)
  | { type: 'turnStarted'; playerId: number }
  | { type: 'compassSpun'; playerId: number; steps: number }
  | { type: 'moved'; playerId: number; path: number[] }
  | { type: 'claimOffered'; playerId: number; nodeId: number }
  | { type: 'claimed'; playerId: number; nodeId: number }
  | { type: 'shipAdded'; playerId: number; shipId: number; dockedAt?: number | null }
  | { type: 'tollOffered'; playerId: number; nodeId: number }
  | { type: 'battleFought'; report: BattleReport }
  | { type: 'tollPaid'; from: number; to: number; amount: number }
  | { type: 'goldChanged'; playerId: number; delta: number; reason: string }
  | { type: 'bankrupt'; playerId: number }
  | { type: 'gameOver'; reason: string } & ({ winner: number; victory: VictoryKind } | { winner: null; victory: null })
  | { type: 'log'; message: string; text?: import('./i18n').Text };

export interface PendingBattle {
  kind: 'colony' | 'pirates';
  nodeId: number;
  attacker: number;
  defender: number | null;
  seed: number;
  setup: import('./battle').BattleSetup;
  commanders: import('./battle').BattleSide[];
  /** Pirate encounters resume landing; pirate event stops end the turn. */
  resumeLanding: boolean;
}
