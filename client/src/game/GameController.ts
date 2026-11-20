import { GameEngine, type GameEvent, type GameState, type PlayerSetup } from '@happy-voyage/shared';
import { EventBus } from './EventBus';

/** Pause before an AI acts, so the human can follow what happens. */
const AI_DELAY_MS = 700;
const SPIN_MS = 1400;
const STEP_MS = 200;
export const ANIMATION_SPEEDS = [1, 2, 4] as const;
type AnimationSpeed = (typeof ANIMATION_SPEEDS)[number];

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
  private speed: AnimationSpeed = 1;
  private skipSailing = false;

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
  spinCompass(): void {
    if (this.isHumanTurn('awaitingSpin')) this.engine!.spinCompass();
  }

  get animationSpeed(): AnimationSpeed {
    return this.speed;
  }

  get spinDuration(): number {
    return SPIN_MS / this.speed;
  }

  setAnimationSpeed(speed: AnimationSpeed): void {
    this.speed = speed;
    this.changed();
  }

  finishSpin(): void {
    if (this.engine?.state.phase === 'spinning') this.engine.sail();
  }

  skipAnimation(): void {
    const engine = this.engine;
    if (engine?.state.phase === 'spinning') {
      this.skipSailing = true;
      try {
        engine.sail();
      } finally {
        this.skipSailing = false;
      }
      engine.resolveLanding();
    } else if (engine?.state.phase === 'moving') {
      EventBus.emit('skip-move');
    }
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
        if (!this.skipSailing) {
          EventBus.emit('animate-move', { playerId: event.playerId, path: event.path, stepMs: STEP_MS / this.speed });
        }
        break;
      case 'turnStarted':
        if (engine.currentPlayer.isAI) this.later(() => engine.spinCompass());
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
