import { GameEngine, type GameEvent, type GameState, type PlayerSetup } from '@happy-voyage/shared';
import { EventBus } from './EventBus';

/** Pause before an AI acts, so the human can follow what happens. */
const AI_DELAY_MS = 700;

/**
 * Owns the rules engine for a single-player match and wires it to the UI:
 * - React subscribes via `subscribe` / `getVersion` (useSyncExternalStore).
 * - Phaser scenes listen on EventBus for redraws and move animations.
 * - AI rivals act automatically on their turns.
 * A multiplayer version would replace this with a socket client that relays
 * the same engine events from the server.
 */
class GameController {
  private engine: GameEngine | null = null;
  private version = 0;
  private readonly subscribers = new Set<() => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    EventBus.on('move-complete', () => {
      if (this.engine?.state.phase === 'moving') this.engine.resolveLanding();
    });
  }

  get state(): GameState | null {
    return this.engine?.state ?? null;
  }

  newGame(players: PlayerSetup[]): void {
    this.clearTimers();
    this.engine = new GameEngine({ players });
    this.engine.on((event) => this.onEngineEvent(event));
    this.engine.start();
    this.changed();
  }

  /** Back to the setup menu. */
  quit(): void {
    this.clearTimers();
    this.engine = null;
    this.changed();
  }

  /** Human actions; ignored when it is not the human's move. */
  roll(): void {
    if (this.isHumanTurn('awaitingRoll')) this.engine!.roll();
  }

  claim(): void {
    if (this.isHumanTurn('awaitingClaim')) this.engine!.claim();
  }

  decline(): void {
    if (this.isHumanTurn('awaitingClaim')) this.engine!.decline();
  }

  islandsOwnedBy(playerId: number): number {
    return this.engine?.islandsOwnedBy(playerId) ?? 0;
  }

  netWorth(playerId: number): number {
    return this.engine?.netWorth(playerId) ?? 0;
  }

  subscribe = (callback: () => void): (() => void) => {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  };

  getVersion = (): number => this.version;

  private onEngineEvent(event: GameEvent): void {
    const engine = this.engine!;
    switch (event.type) {
      case 'goldChanged':
        EventBus.emit('gold-changed', event);
        break;
      case 'moved':
        EventBus.emit('animate-move', { playerId: event.playerId, path: event.path });
        break;
      case 'turnStarted':
        if (engine.currentPlayer.isAI) this.later(() => engine.roll());
        break;
      case 'claimOffered':
        if (engine.currentPlayer.isAI) this.later(() => engine.decideForAI());
        break;
    }
    this.changed();
  }

  private isHumanTurn(phase: GameState['phase']): boolean {
    return !!this.engine && this.engine.state.phase === phase && !this.engine.currentPlayer.isAI;
  }

  private later(action: () => void): void {
    const engine = this.engine;
    // Drop the action if a new game started in the meantime.
    this.timers.push(setTimeout(() => this.engine === engine && action(), AI_DELAY_MS));
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private changed(): void {
    this.version += 1;
    this.subscribers.forEach((callback) => callback());
    EventBus.emit('state-changed');
  }
}

export const gameController = new GameController();
