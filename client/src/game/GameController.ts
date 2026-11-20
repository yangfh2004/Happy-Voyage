import { GameEngine, type GameEvent, type GameState, type PlayerSetup } from '@happy-voyage/shared';
import { EventBus } from './EventBus';

export const SPEEDS = {
  Normal: { ai: 700, step: 200 },
  Fast: { ai: 250, step: 70 },
  Instant: { ai: 0, step: 0 },
};
export type GameSpeed = keyof typeof SPEEDS;
const SPEED_KEY = 'happy-voyage-speed';

function savedSpeed(): GameSpeed {
  try {
    const saved = localStorage.getItem(SPEED_KEY);
    if (saved && Object.hasOwn(SPEEDS, saved)) return saved as GameSpeed;
  } catch {}
  return 'Normal';
}

/**
 * Owns the rules engine for a single-player match and wires it to the UI:
 * - React subscribes via `subscribe` / `getVersion` (useSyncExternalStore).
 * - Phaser scenes listen on EventBus for redraws and move animations.
 * - AI rivals act automatically on their turns.
 * A multiplayer version would replace this with a socket client that relays
 * the same engine events from the server.
 */
export class GameController {
  private engine: GameEngine | null = null;
  private version = 0;
  private readonly subscribers = new Set<() => void>();
  speed = savedSpeed();
  private skipping = false;
  private moveId = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: (() => void) | null = null;
  private pendingSince = 0;

  constructor() {
    EventBus.on('move-complete', (id: number) => {
      if (id === this.moveId && this.engine?.state.phase === 'moving') this.engine.resolveLanding();
    });
  }

  get state(): GameState | null {
    return this.engine?.state ?? null;
  }

  get timings() {
    return SPEEDS[this.skipping ? 'Instant' : this.speed];
  }

  get waiting(): boolean {
    return !!this.engine && this.engine.state.phase !== 'gameOver' &&
      (this.engine.state.phase === 'moving' || this.engine.currentPlayer.isAI);
  }

  setSpeed(speed: GameSpeed): void {
    this.speed = speed;
    try { localStorage.setItem(SPEED_KEY, speed); } catch {}
    this.refreshPacing();
  }

  skipToMyTurn(): void {
    if (!this.waiting) return;
    this.skipping = true;
    this.refreshPacing();
  }

  private refreshPacing(): void {
    this.schedulePending();
    EventBus.emit('pacing-changed');
    this.changed();
  }

  newGame(players: PlayerSetup[]): void {
    this.clearTimers();
    this.skipping = false;
    this.moveId += 1;
    EventBus.emit('cancel-move');
    this.engine = new GameEngine({ players });
    this.engine.on((event) => this.onEngineEvent(event));
    this.engine.start();
    this.changed();
  }

  /** Back to the setup menu. */
  quit(): void {
    this.clearTimers();
    this.skipping = false;
    this.moveId += 1;
    EventBus.emit('cancel-move');
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
        EventBus.emit('animate-move', { playerId: event.playerId, path: event.path, id: ++this.moveId });
        break;
      case 'turnStarted':
        if (!engine.currentPlayer.isAI) this.skipping = false;
        if (engine.currentPlayer.isAI) this.later(() => engine.roll());
        break;
      case 'claimOffered':
        if (!engine.currentPlayer.isAI) this.skipping = false;
        if (engine.currentPlayer.isAI) this.later(() => engine.decideForAI());
        break;
      case 'gameOver':
        this.skipping = false;
        this.clearTimers();
        break;
    }
    this.changed();
  }

  private isHumanTurn(phase: GameState['phase']): boolean {
    return !!this.engine && this.engine.state.phase === phase && !this.engine.currentPlayer.isAI;
  }

  private later(action: () => void): void {
    const engine = this.engine;
    this.pending = () => { if (this.engine === engine) action(); };
    this.pendingSince = Date.now();
    this.schedulePending();
  }

  private schedulePending(): void {
    clearTimeout(this.timer);
    if (!this.pending) return;
    this.timer = setTimeout(() => {
      const action = this.pending;
      this.pending = null;
      action?.();
    }, Math.max(0, this.timings.ai - (Date.now() - this.pendingSince)));
  }

  private clearTimers(): void {
    clearTimeout(this.timer);
    this.pending = null;
  }

  private changed(): void {
    this.version += 1;
    this.subscribers.forEach((callback) => callback());
    EventBus.emit('state-changed');
  }
}

export const gameController = new GameController();
