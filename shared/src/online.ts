import type { GameEngine } from './engine';
import type { GameModeId } from './modes';
import type { Nation } from './nations';
import type { AIDifficulty, GameEvent, GameState } from './types';

export const MIN_ROOM_PLAYERS = 2;
export const MAX_ROOM_PLAYERS = 6;
export const ROOM_ID_PATTERN = /^[0-9a-f]{16}$/;
export const ONLINE_PACING = {
  human: { spin: 650, step: 80 },
  rival: { spin: 160, step: 30, decision: 120 },
};

export function sailingStepDuration(step: number, isAI: boolean): number {
  return step * (isAI ? 0.7 : 2.4);
}

export interface RoomPick {
  name: string;
  nation: Nation;
}

export interface RoomOptions {
  mode: GameModeId;
  difficulty: AIDifficulty;
}

export interface RoomSeat extends RoomPick {
  id: string;
  connected: boolean;
}

export interface RoomLobby extends RoomOptions {
  id: string;
  host: string;
  started: boolean;
  failed: boolean;
  seats: RoomSeat[];
}

export interface RoomPass {
  roomId: string;
  seatId: string;
  token: string;
}

type PlayerActions = Pick<GameEngine,
  'setRetreatThreshold' |
  'spinCompass' | 'returnToColony' | 'claim' | 'decline' | 'acceptMerchant' | 'buyMerchant' | 'declineMerchant' | 'wyvernFly' |
  'salvageWreck' |
  'payToll' | 'useStrategy' | 'fight' | 'acceptBarter' | 'recruitCaptain' | 'declineRecruit' | 'declineBarter' |
  'buyLotteryNumber' | 'drawLottery' | 'finishLottery' | 'challengeHermit' | 'takeMistStones' | 'leaveMistIsland' |
  'leaveRevivalIsland' |
  'dockShip' | 'boardShip' | 'loadCargo' | 'unloadCargo' | 'autoLoad' | 'build' | 'buildShip' |
  'finishBuilding' | 'tradeAtMarket' | 'finishTrading' | 'buyUsedShip' | 'sellShip' | 'finishMarket'
>;

export type RoomAction = {
  [K in keyof PlayerActions]: [K, ...Parameters<PlayerActions[K]>];
}[keyof PlayerActions];

export type RoomRequest =
  | ({ type: 'create'; pick: RoomPick } & RoomOptions)
  | { type: 'join'; roomId: string; pick: RoomPick }
  | { type: 'resume'; roomId: string; token: string }
  | { type: 'leave' | 'start' }
  | { type: 'act'; revision: number; action: RoomAction };

export type RoomReply = { ok: true; pass?: RoomPass } | { ok: false; error: string };

export interface RoomSnapshot {
  roomId: string;
  revision: number;
  playerId: number;
  hasHoard: boolean;
  state: GameState;
  events: GameEvent[];
}

export interface RoomServerEvents {
  'room:lobby': (lobby: RoomLobby) => void;
  'room:game': (snapshot: RoomSnapshot) => void;
}

export interface RoomClientEvents {
  'room:request': (request: RoomRequest, reply: (response: RoomReply) => void) => void;
}
