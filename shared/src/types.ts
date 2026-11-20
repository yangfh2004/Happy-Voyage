/**
 * Core data types shared by the client (single-player today) and the server
 * (authoritative multiplayer later). Keep these plain, serialisable objects so
 * a whole GameState can be sent over the network or saved to a database.
 */

/** What a stop on the sea route does when a fleet lands on it. */
export type NodeKind = 'port' | 'island' | 'event' | 'special';
export type SpecialKind = 'skeleton' | 'treasure' | 'mist' | 'revival' | 'nightless' | 'wind' | 'dragonSnake';

/** Random-event stops (the "joy core" of the original game). */
export type EventKind = 'treasure' | 'storm' | 'tradeWind' | 'pirates' | 'seaMonster' | 'whirlpool' | 'bottle' | 'floatingCargo' | 'merchant' | 'wyvern';

/** One stop on the node-based sea route. */
export interface MapNode {
  id: number;
  name: string;
  kind: NodeKind;
  special?: SpecialKind;
  chineseName?: string;
  nation?: string;
  /** World position in pixels, used by the renderer only. */
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

export interface PlayerSetup {
  name: string;
  nation?: string;
  /** 0xRRGGBB, used for the ship token and colony flags. */
  color: number;
  isAI: boolean;
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
}

export interface Player extends PlayerSetup {
  id: number;
  gold: number;
  /** Index of the map node the fleet is on. */
  position: number;
  bankrupt: boolean;
  homePort: number;
  revivalProtection: boolean;
  captain: boolean;
  fleet: Ship[];
}

export type BuildingKind = 'lumberMill' | 'ironMine' | 'shipyard' | 'repairYard' | 'collectionField';
export type Specialty = 'Wine' | 'Sugar' | 'Cotton' | 'Timber' | 'Cocoa' | 'Tobacco' | 'Silver' | 'Spices' | 'Silk' | 'Tea';
export type Good = 'lumber' | 'iron' | Specialty;

export interface ColonyStockpile {
  lumber: number;
  iron: number;
  specialties: Partial<Record<Specialty, number>>;
}

export type Phase = 'awaitingSpin' | 'spinning' | 'moving' | 'awaitingClaim' | 'awaitingBuild' | 'gameOver';

export interface GameConfig {
  startingGold: number;
  /** Paid by the crown every time a fleet passes or lands on the home port. */
  homeSalary: number;
  /** Claiming this many islands wins immediately. */
  islandsToWin: number;
  /** After this many rounds the richest navigator wins. */
  maxRounds: number;
}

export interface GameState {
  config: GameConfig;
  map: MapNode[];
  players: Player[];
  nextShipId: number;
  /** owners[nodeId] = owning player id, or null when neutral / not an island. */
  owners: (number | null)[];
  buildings: Partial<Record<BuildingKind, number>>[];
  stockpiles: ColonyStockpile[];
  docks: Ship[][];
  currentPlayer: number;
  round: number;
  phase: Phase;
  lastSpin: number | null;
  /** Island the current player may claim while phase === 'awaitingClaim'. */
  pendingClaim: number | null;
  winner: number | null;
  log: string[];
}

/** Everything the engine announces; renderers and the network layer subscribe. */
export type GameEvent =
  | { type: 'shipTransferred'; playerId: number; nodeId: number; shipId: number; direction: 'dock' | 'board' }
  | { type: 'cargoMoved'; playerId: number; nodeId: number; shipId: number; good: Good; qty: number; direction: 'load' | 'unload' }
  | { type: 'buildingBuilt'; playerId: number; nodeId: number; kind: BuildingKind; level: number }
  | { type: 'buildOffered'; playerId: number; nodeId: number }
  | { type: 'turnStarted'; playerId: number }
  | { type: 'compassSpun'; playerId: number; steps: number }
  | { type: 'moved'; playerId: number; path: number[] }
  | { type: 'claimOffered'; playerId: number; nodeId: number }
  | { type: 'claimed'; playerId: number; nodeId: number }
  | { type: 'shipAdded'; playerId: number; shipId: number }
  | { type: 'tollPaid'; from: number; to: number; amount: number }
  | { type: 'goldChanged'; playerId: number; delta: number; reason: string }
  | { type: 'bankrupt'; playerId: number }
  | { type: 'gameOver'; winner: number; reason: string }
  | { type: 'log'; message: string };
