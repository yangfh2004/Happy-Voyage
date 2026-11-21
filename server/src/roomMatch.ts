import { GameEngine, ONLINE_PACING, createNationRoster, gameMode, sailingStepDuration, type GameEvent, type Rng, type RoomOptions, type RoomPick } from '@happy-voyage/shared';
import { applyRoomAction } from './roomActions';

export interface RoomMatchOptions {
  paceMultiplier?: number;
  rng?: Rng;
}

/** Only the room server advances animation phases, AI turns, and the lottery clock. */
export class RoomMatch {
  readonly engine: GameEngine;
  revision = 0;
  failed = false;
  private events: GameEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private nextLotteryTick = 0;

  constructor(
    seats: RoomPick[],
    options: RoomOptions,
    private readonly publish: (events: GameEvent[]) => void,
    private readonly onError: () => void,
    private readonly timing: RoomMatchOptions = {},
  ) {
    this.engine = new GameEngine({ players: createNationRoster(seats, options.difficulty), config: gameMode(options.mode).config, rng: timing.rng });
    this.engine.on((event) => this.events.push(event));
  }

  start(): void {
    this.update(() => this.engine.start());
  }

  act(playerId: number, revision: unknown, action: unknown): void {
    if (this.failed) throw new Error('This voyage has stopped due to a server error.');
    const { currentPlayer, state } = this.engine;
    if (state.phase === 'gameOver') throw new Error('This voyage has ended.');
    if (currentPlayer.isAI || currentPlayer.id !== playerId) throw new Error('It is not your turn.');
    if (revision !== this.revision) throw new Error('The voyage has advanced. Try again.');
    this.update(() => applyRoomAction(this.engine, action));
  }

  dispose(): void {
    clearTimeout(this.timer);
  }

  private update(action: () => void): void {
    this.events = [];
    action();
    this.revision += 1;
    this.publish(this.events);
    this.schedule();
  }

  private schedule(): void {
    this.dispose();
    const { engine } = this;
    const { phase, lottery, lastSpin } = engine.state;
    const ai = engine.currentPlayer.isAI;
    const humanLottery = !ai && phase === 'awaitingLottery' && lottery && !lottery.draw;
    if (!humanLottery) this.nextLotteryTick = 0;
    if (phase === 'gameOver') return;
    const later = (delay: number, action: () => void) => {
      this.timer = setTimeout(() => {
        try {
          this.update(action);
        } catch (error) {
          console.error('Room simulation failed:', error);
          this.failed = true;
          this.onError();
        }
      }, delay);
      this.timer.unref();
    };
    const pace = ai ? ONLINE_PACING.rival : ONLINE_PACING.human;
    const scale = this.timing.paceMultiplier ?? 1;
    if (phase === 'spinning') later(pace.spin * scale, () => engine.sail());
    else if (phase === 'moving') later((sailingStepDuration(pace.step, ai) * (lastSpin ?? 1) + 100) * scale, () => engine.resolveLanding());
    else if (ai) later(ONLINE_PACING.rival.decision * scale, () => {
      const { currentPlayer, round } = engine.state;
      engine.decideForAI();
      if (phase === 'awaitingSpin' && engine.state.phase === phase &&
          engine.state.currentPlayer === currentPlayer && engine.state.round === round) engine.spinCompass();
    });
    else if (humanLottery) {
      this.nextLotteryTick ||= Date.now() + 1000;
      later(Math.max(0, this.nextLotteryTick - Date.now()), () => {
        const seconds = 1 + Math.floor(Math.max(0, Date.now() - this.nextLotteryTick) / 1000);
        this.nextLotteryTick += seconds * 1000;
        engine.advanceLotteryClock(seconds);
      });
    }
  }
}
