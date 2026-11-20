import { GameEngine, type GameEvent, type GameState, type Player, type PlayerSetup } from '@happy-voyage/shared';
import { EventBus } from './EventBus';
import { TurnFeedback } from './TurnFeedback';
import { isMuted, setMuted, sfx } from './sfx';

/** A moment worth celebrating (or groaning at) for the human, shown until their next roll. */
export interface Headline {
  text: string;
  tone: 'gain' | 'loss';
}

export const SPEEDS = {
  Normal: { ai: 700, step: 200, spin: 1400 },
  Fast: { ai: 250, step: 70, spin: 500 },
  Instant: { ai: 0, step: 0, spin: 0 },
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
  feedback = new TurnFeedback();
  private skipping = false;
  private moveId = 0;
  private spinSequence = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: (() => void) | null = null;
  private pendingSince = 0;
  /** Where the sailing fleet set out from, so text views don't reveal its destination early. */
  private departure: { playerId: number; position: number } | null = null;
  headline: Headline | null = null;

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

  get spinId(): number {
    return this.spinSequence;
  }

  get waiting(): boolean {
    return !!this.engine && this.engine.state.phase !== 'gameOver' &&
      (this.engine.state.phase === 'spinning' || this.engine.state.phase === 'moving' || this.engine.currentPlayer.isAI);
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
    if (this.timings.spin === 0) this.finishSpin(this.spinId);
    EventBus.emit('pacing-changed');
    this.changed();
  }

  newGame(players: PlayerSetup[]): void {
    this.clearTimers();
    this.skipping = false;
    this.moveId += 1;
    EventBus.emit('cancel-move');
    this.headline = null;
    this.engine = new GameEngine({ players });
    this.feedback = new TurnFeedback();
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
    this.feedback = new TurnFeedback();
    this.changed();
  }

  /** Human actions; ignored when it is not the human's move. */
  spinCompass(): void {
    if (this.isHumanTurn('awaitingSpin')) this.beginSpin(this.engine!);
  }

  finishSpin(id: number): void {
    if (id === this.spinId && this.engine?.state.phase === 'spinning') this.engine.sail();
  }

  private beginSpin(engine: GameEngine): void {
    engine.spinCompass();
    if (this.timings.spin === 0) this.finishSpin(this.spinId);
  }

  claim(): void {
    if (this.isHumanTurn('awaitingClaim')) this.engine!.claim();
  }

  decline(): void {
    if (this.isHumanTurn('awaitingClaim')) this.engine!.decline();
  }

  /** A fleet's stop as the board shows it: its departure stop until it has sailed in. */
  shownPosition(player: Player): number {
    const sailing = this.departure?.playerId === player.id && this.engine?.state.phase === 'moving';
    return sailing ? this.departure!.position : player.position;
  }

  get muted(): boolean {
    return isMuted();
  }

  toggleMute(): void {
    setMuted(!isMuted());
    this.changed();
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
    this.feedback.observe(event, engine.state);
    const players = engine.state.players;
    const isHuman = (id: number) => !players[id].isAI;
    EventBus.emit('engine-event', event);
    switch (event.type) {
      case 'compassSpun':
        this.spinSequence += 1;
        this.departure = { playerId: event.playerId, position: players[event.playerId].position };
        if (isHuman(event.playerId)) this.headline = null;
        sfx.spin();
        break;
      case 'goldChanged':
        EventBus.emit('gold-changed', event);
        if (event.reason === 'royal salary' || event.reason === 'treasure' || event.reason === 'trade') sfx.coin();
        else if (event.reason === 'storm repairs') sfx.storm();
        break;
      case 'moved':
        EventBus.emit('animate-move', { playerId: event.playerId, path: event.path, id: ++this.moveId });
        break;
      case 'turnStarted':
        if (!engine.currentPlayer.isAI) this.skipping = false;
        if (engine.currentPlayer.isAI) this.later(() => this.beginSpin(engine));
        break;
      case 'tollPaid': {
        const at = engine.state.map[players[event.from].position].name;
        if (isHuman(event.to)) {
          this.headline = { text: `${players[event.from].name} pays you ${event.amount}g toll at ${at}!`, tone: 'gain' };
          sfx.coin();
        } else if (isHuman(event.from)) {
          this.headline = { text: `You pay ${players[event.to].name} ${event.amount}g toll at ${at}.`, tone: 'loss' };
          sfx.pay();
        } else {
          sfx.coin();
        }
        break;
      }
      case 'claimed': {
        const node = engine.state.map[event.nodeId];
        if (isHuman(event.playerId)) this.headline = { text: `${node.name} is yours! Rivals now pay you ${node.toll}g here.`, tone: 'gain' };
        sfx.claim();
        break;
      }
      case 'claimOffered':
        if (!engine.currentPlayer.isAI) this.skipping = false;
        if (engine.currentPlayer.isAI) this.later(() => engine.decideForAI());
        break;
      case 'gameOver':
        if (isHuman(event.winner)) sfx.win();
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
