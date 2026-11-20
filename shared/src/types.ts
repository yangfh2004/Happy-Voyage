/**
 * Core data types shared by the client (single-player today) and the server
 * (authoritative multiplayer later). Keep these plain, serialisable objects so
 * a whole GameState can be sent over the network or saved to a database.
 */

/** What a stop on the sea route does when a fleet lands on it. */
export type NodeKind = 'port' | 'island' | 'event';

/** Random-event stops (the "joy core" of the original game). */
export type EventKind = 'treasure' | 'storm' | 'tradeWind';

/** One stop on the node-based sea route. */
export interface MapNode {
  id: number;
  name: string;
  kind: NodeKind;
  /** World position in pixels, used by the renderer only. */
  x: number;
  y: number;
  /** Islands only: cost to found a colony. */
  price?: number;
  /** Islands only: toll a rival pays when landing on the colony. */
  toll?: number;
  /** Islands only: the local specialty (traded in a later version). */
  specialty?: string;
  /** Event stops only. */
  event?: EventKind;
}

export interface PlayerSetup {
  name: string;
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
  fleet: Ship[];
}

export type Phase = 'awaitingRoll' | 'moving' | 'awaitingClaim' | 'gameOver';

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
  currentPlayer: number;
  round: number;
  phase: Phase;
  lastRoll: [number, number] | null;
  /** Island the current player may claim while phase === 'awaitingClaim'. */
  pendingClaim: number | null;
  winner: number | null;
  log: string[];
}

/** Everything the engine announces; renderers and the network layer subscribe. */
export type GameEvent =
  | { type: 'turnStarted'; playerId: number }
  | { type: 'diceRolled'; playerId: number; dice: [number, number] }
  | { type: 'moved'; playerId: number; path: number[] }
  | { type: 'claimOffered'; playerId: number; nodeId: number }
  | { type: 'claimed'; playerId: number; nodeId: number }
  | { type: 'shipAdded'; playerId: number; shipId: number }
  | { type: 'tollPaid'; from: number; to: number; amount: number }
  | { type: 'goldChanged'; playerId: number; delta: number; reason: string }
  | { type: 'bankrupt'; playerId: number }
  | { type: 'gameOver'; winner: number; reason: string }
  | { type: 'log'; message: string };
