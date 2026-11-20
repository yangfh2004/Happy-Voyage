import { CAMPAIGN_STAGES, GameEngine, GameView, LOTTERY, NATIONS, ONLINE_PACING, quoteMarketTrade, type Good, type BuildingKind, type CampaignSetup, type EngineOptions, type GameConfig, type GameEvent, type GameState, type LotteryDraw, type MarketOrder, type Player, type PlayerSetup, type RoomAction, type RoomSnapshot, type ShipType } from '@happy-voyage/shared';
import { OnlineRoom, roomLink } from './OnlineRoom';
import { EventBus } from './EventBus';
import type { HermitId, StrategyId } from '@happy-voyage/shared';
import { TurnFeedback } from './TurnFeedback';
import { isMuted, setMuted, setVolume, sfx, startSoundtrack, type SoundChannel } from './sfx';
import type { SeaEventResult } from '@happy-voyage/shared';

export interface SeaNotice {
  id: number;
  event: SeaEventResult;
  playerName: string;
  destination?: string;
}

/** A moment worth celebrating (or groaning at) for the human, shown until their next roll. */
export interface Headline {
  text: string;
  tone: 'gain' | 'loss';
  royal?: boolean;
}

export const SPEEDS = {
  Normal: { ai: 700, step: 200, spin: 1400 },
  Fast: { ai: 250, step: 70, spin: 500 },
  Instant: { ai: 0, step: 0, spin: 0 },
};
export type GameSpeed = keyof typeof SPEEDS;
const SPEED_KEY = 'happy-voyage-speed';
export const SEA_NOTICE_LIMIT = 3;
export const SEA_NOTICE_DURATION_MS = 5000;

function savedSpeed(): GameSpeed {
  try {
    const saved = localStorage.getItem(SPEED_KEY);
    if (saved && Object.hasOwn(SPEEDS, saved)) return saved as GameSpeed;
  } catch {}
  return 'Normal';
}

/** Length of one ball's drop animation (matches `ball-drop` in styles.css). */
export const LOTTERY_BALL_DROP_MS = 450;
/** Fallback slack if the last ball's animationend never arrives (e.g. reduced motion, hidden tab). */
const LOTTERY_REVEAL_GRACE_MS = 500;

export class GameController {
  private engine: GameEngine | null = null;
  private onlineView: GameView | null = null;
  room: OnlineRoom | null = null;
  private version = 0;
  private readonly subscribers = new Set<() => void>();
  speed = savedSpeed();
  feedback = new TurnFeedback();
  private skipping = false;
  private moveId = 0;
  private pendingMove: { playerId: number; path: number[]; id: number } | null = null;
  private spinSequence = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lotteryClock: ReturnType<typeof setInterval> | undefined;
  private lotteryReveal: ReturnType<typeof setTimeout> | undefined;
  /** False while the drawn balls are still dropping into the jar; the result and Sail on wait for it. */
  lotteryRevealed = true;
  /** The human's draw whose prize, log line and toast wait until the last ball lands. */
  private lotteryHeld: { draw: LotteryDraw; logCut: number; events: GameEvent[] } | null = null;
  private lotteryShown: LotteryDraw | null = null;
  private pending: (() => void) | null = null;
  private pendingSince = 0;
  /** Where the sailing fleet set out from, so text views don't reveal its destination early. */
  private departure: { playerId: number; position: number } | null = null;
  headline: Headline | null = null;
  /** The outgoing human's last headline, shown on the pass-the-device screen. */
  handoffNote: (Headline & { playerId: number }) | null = null;
  /** The human seat the screen speaks to ("you"): whoever of the humans sailed most recently. */
  viewerId: number | null = null;
  /** Hot-seat pause: the device must be passed to this human before their turn begins. */
  handoffTo: number | null = null;
  seaNotices: SeaNotice[] = [];
  private noticeId = 0;
  private readonly noticeTimers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    EventBus.on('move-complete', (id: number) => {
      if (id !== this.moveId) return;
      this.pendingMove = null;
      if (this.engine?.state.phase === 'moving') {
        this.departure = { playerId: this.engine.currentPlayer.id, position: this.engine.currentPlayer.position };
        this.engine.resolveLanding();
      }
    });
  }

  get state(): GameState | null {
    return this.view?.state ?? null;
  }

  private get view(): GameView | null {
    return this.engine ?? this.onlineView;
  }

  get timings() {
    const local = SPEEDS[this.skipping ? 'Instant' : this.speed];
    if (!this.room) return local;
    const online = this.view?.currentPlayer.isAI ? ONLINE_PACING.rival : ONLINE_PACING.human;
    return { ...local, spin: Math.min(local.spin, online.spin), step: Math.min(local.step, online.step) };
  }

  get spinId(): number {
    return this.spinSequence;
  }

  get waiting(): boolean {
    return !!this.view && this.view.state.phase !== 'gameOver' &&
      (this.view.state.phase === 'spinning' || this.view.state.phase === 'moving' || this.view.currentPlayer.isAI);
  }

  get canHelm(): boolean {
    const player = this.view?.currentPlayer;
    return !!player && !player.isAI && !this.awaitingHandoff &&
      (!this.room || (this.room.ready && !this.room.lobby?.failed && this.viewerId === player.id));
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

  openOnline(invite: string | null = null): void {
    if (this.room || this.engine) return;
    const room = new OnlineRoom(invite, () => {
      if (this.room === room) this.changed();
    }, (snapshot) => {
      if (this.room === room) this.receiveGame(snapshot);
    });
    this.room = room;
    room.reconnect();
    this.changed();
  }

  private receiveGame(snapshot: RoomSnapshot): void {
    if (this.state?.phase === 'moving' && snapshot.state.phase !== 'moving' && this.pendingMove) {
      this.pendingMove = null;
      EventBus.emit('cancel-move');
    }
    this.viewerId = snapshot.playerId;
    this.onlineView = new GameView(snapshot.state, snapshot.hasHoard);
    for (const event of snapshot.events) this.onEngineEvent(event);
    this.changed();
  }

  private perform(action: RoomAction, local: () => unknown): void {
    if (this.room) this.room.act(action);
    else local();
  }

  newGame(players: PlayerSetup[], config?: Partial<GameConfig>): void {
    this.beginGame({ players, config });
  }

  newCampaign(campaign: CampaignSetup): void {
    this.beginGame({ campaign });
  }

  nextCampaignStage(): void {
    const state = this.state;
    const campaign = state?.campaign;
    if (!state || campaign?.status !== 'completed') return;
    const next = CAMPAIGN_STAGES[CAMPAIGN_STAGES.findIndex((stage) => stage.id === campaign.stage) + 1];
    const player = state.players[campaign.playerId];
    const nation = NATIONS.find(({ name }) => name === player.nation);
    if (next && nation) this.newCampaign({ stage: next.id, navigator: { name: player.name, nation: nation.name } });
  }

  private beginGame(options: EngineOptions): void {
    this.clearTimers();
    this.skipping = false;
    this.moveId += 1;
    this.pendingMove = null;
    EventBus.emit('cancel-move');
    this.headline = null;
    this.clearSeaNotices();
    this.engine = new GameEngine(options);
    this.viewerId = this.engine.state.players.find((player) => !player.isAI)?.id ?? null;
    this.handoffTo = null;
    this.handoffNote = null;
    this.feedback = new TurnFeedback();
    this.engine.on((event) => this.onEngineEvent(event));
    this.engine.start();
    this.changed();
  }

  /** Back to the setup menu. */
  quit(): void {
    const room = this.room;
    this.room = null;
    this.onlineView = null;
    if (room) {
      room.close();
      window.history.replaceState(null, '', roomLink(null));
    }
    this.clearTimers();
    this.clearSeaNotices();
    this.skipping = false;
    this.moveId += 1;
    this.pendingMove = null;
    EventBus.emit('cancel-move');
    this.engine = null;
    this.viewerId = null;
    this.handoffTo = null;
    this.handoffNote = null;
    this.headline = null;
    this.feedback = new TurnFeedback();
    this.changed();
  }

  /** How many seats are played by people in the match. */
  get humanCount(): number {
    return this.state?.players.filter((player) => !player.isAI).length ?? 0;
  }

  /** True while the seat at the helm still has to take the device. */
  get awaitingHandoff(): boolean {
    return this.handoffTo !== null && this.handoffTo === this.engine?.state.currentPlayer;
  }

  /** The next human has taken the device; their turn may begin. */
  confirmHandoff(): void {
    if (this.handoffTo === null) return;
    this.handoffTo = null;
    this.handoffNote = null;
    this.changed();
  }

  /** Human actions; ignored when it is not the human's move. */
  spinCompass(): void {
    if (this.isHumanTurn('awaitingSpin')) this.perform(['spinCompass'], () => this.beginSpin(this.engine!));
  }

  finishSpin(id: number): void {
    if (id === this.spinId && this.engine?.state.phase === 'spinning') this.engine.sail();
  }

  resumeMovement(): void {
    if (this.pendingMove) EventBus.emit('animate-move', this.pendingMove);
  }

  private beginSpin(engine: GameEngine): void {
    engine.spinCompass();
    if (this.timings.spin === 0) this.finishSpin(this.spinId);
  }

  claim(): void {
    if (this.isHumanTurn('awaitingClaim')) this.perform(['claim'], () => this.engine!.claim());
  }

  decline(): void {
    if (this.isHumanTurn('awaitingClaim')) this.perform(['decline'], () => this.engine!.decline());
    else if (this.isHumanTurn('awaitingMerchant')) this.declineMerchant();
    else if (this.isHumanTurn('awaitingRecruit')) this.declineRecruit();
    else this.declineBarter();
  }

  acceptMerchant(): void {
    if (this.isHumanTurn('awaitingMerchant')) this.perform(['acceptMerchant'], () => this.engine!.acceptMerchant());
  }

  declineMerchant(): void {
    if (this.isHumanTurn('awaitingMerchant')) this.perform(['declineMerchant'], () => this.engine!.declineMerchant());
  }

  wyvernFly(nodeId: number): void {
    if (this.isHumanTurn('awaitingWyvern')) this.perform(['wyvernFly', nodeId], () => this.engine!.wyvernFly(nodeId));
  }

  dismissSeaNotice(id: number): void {
    clearTimeout(this.noticeTimers.get(id));
    this.noticeTimers.delete(id);
    this.seaNotices = this.seaNotices.filter((notice) => notice.id !== id);
    this.changed();
  }

  private clearSeaNotices(): void {
    for (const timer of this.noticeTimers.values()) clearTimeout(timer);
    this.noticeTimers.clear();
    this.seaNotices = [];
  }

  payToll(): void {
    if (this.isHumanTurn('awaitingToll')) this.perform(['payToll'], () => this.engine!.payToll());
  }

  canUseStrategy(id: StrategyId, target?: number): boolean {
    return this.canHelm && (this.view?.canUseStrategy(id, target) ?? false);
  }

  useStrategy(id: StrategyId, target?: number): void {
    if (this.canUseStrategy(id, target)) this.perform(target === undefined ? ['useStrategy', id] : ['useStrategy', id, target], () => this.engine!.useStrategy(id, target));
  }

  fight(): void {
    if (this.isHumanTurn('awaitingToll')) this.perform(['fight'], () => this.engine!.fight());
  }

  acceptBarter(index: number): void {
    if (this.isHumanTurn('awaitingBarter')) this.perform(['acceptBarter', index], () => this.engine!.acceptBarter(index));
  }

  recruitCaptain(index: number): void {
    if (this.isHumanTurn('awaitingRecruit')) this.perform(['recruitCaptain', index], () => this.engine!.recruitCaptain(index));
  }

  declineRecruit(): void {
    if (this.isHumanTurn('awaitingRecruit')) this.perform(['declineRecruit'], () => this.engine!.declineRecruit());
  }

  declineBarter(): void {
    if (this.isHumanTurn('awaitingBarter')) this.perform(['declineBarter'], () => this.engine!.declineBarter());
  }

  canBuyLotteryNumber(number: number): boolean {
    return this.isHumanTurn('awaitingLottery') && this.view!.canBuyLotteryNumber(number);
  }

  buyLotteryNumber(number: number): void {
    if (this.canBuyLotteryNumber(number)) {
      this.perform(['buyLotteryNumber', number], () => this.engine!.buyLotteryNumber(number));
      if (!this.room) this.changed();
    }
  }

  /** Draw the balls now instead of waiting for the timer. */
  drawLottery(): void {
    if (this.isHumanTurn('awaitingLottery') && !this.state?.lottery?.draw) this.perform(['drawLottery'], () => this.engine!.drawLottery());
  }

  finishLottery(): void {
    if (this.isHumanTurn('awaitingLottery') && this.state?.lottery?.draw && this.lotteryRevealed) this.perform(['finishLottery'], () => this.engine!.finishLottery());
  }

  challengeHermit(id: HermitId): void {
    if (this.isHumanTurn('awaitingMistDuel') && !this.state?.mistDuel?.hermitId) this.perform(['challengeHermit', id], () => this.engine!.challengeHermit(id));
  }

  takeMistStones(count: number): void {
    if (this.isHumanTurn('awaitingMistDuel') && this.view!.canTakeMistStones(count)) this.perform(['takeMistStones', count], () => this.engine!.takeMistStones(count));
  }

  leaveMistIsland(): void {
    if (this.isHumanTurn('awaitingMistDuel') && this.view!.canLeaveMistIsland()) this.perform(['leaveMistIsland'], () => this.engine!.leaveMistIsland());
  }

  canBuild(kind: BuildingKind): boolean {
    return this.isHumanTurn('awaitingBuild') && this.view!.canBuild(kind);
  }

  dockShip(shipId: number): void {
    if (this.isHumanTurn('awaitingBuild')) this.perform(['dockShip', shipId], () => this.engine!.dockShip(shipId));
  }

  boardShip(shipId: number): void {
    if (this.isHumanTurn('awaitingBuild')) this.perform(['boardShip', shipId], () => this.engine!.boardShip(shipId));
  }

  loadCargo(shipId: number, good: Good, qty: number): void {
    if (this.isHumanTurn('awaitingBuild')) this.perform(['loadCargo', shipId, good, qty], () => this.engine!.loadCargo(shipId, good, qty));
  }

  unloadCargo(shipId: number, good: Good, qty: number): void {
    if (this.isHumanTurn('awaitingBuild')) this.perform(['unloadCargo', shipId, good, qty], () => this.engine!.unloadCargo(shipId, good, qty));
  }

  autoLoad(): void {
    if (this.isHumanTurn('awaitingBuild')) this.perform(['autoLoad'], () => this.engine!.autoLoad());
  }

  build(kind: BuildingKind): void {
    if (this.canBuild(kind)) this.perform(['build', kind], () => this.engine!.build(kind));
  }

  canBuildShip(type: ShipType): boolean {
    return this.isHumanTurn('awaitingBuild') && this.view!.canBuildShip(type);
  }

  buildShip(type: ShipType): void {
    if (this.canBuildShip(type)) this.perform(['buildShip', type], () => this.engine!.buildShip(type));
  }

  finishBuilding(): void {
    if (this.isHumanTurn('awaitingBuild')) this.perform(['finishBuilding'], () => this.engine!.finishBuilding());
  }

  tradeAtMarket(order: MarketOrder): void {
    if (this.isHumanTurn('awaitingCargoMarket') && quoteMarketTrade(this.view!.state, order) !== null) {
      this.perform(['tradeAtMarket', order], () => this.engine!.tradeAtMarket(order));
    }
  }

  finishTrading(): void {
    if (this.isHumanTurn('awaitingCargoMarket')) this.perform(['finishTrading'], () => this.engine!.finishTrading());
  }

  canBuyUsedShip(type: ShipType): boolean {
    return this.isHumanTurn('awaitingMarket') && this.view!.canBuyUsedShip(type);
  }

  buyUsedShip(type: ShipType): void {
    if (this.canBuyUsedShip(type)) this.perform(['buyUsedShip', type], () => this.engine!.buyUsedShip(type));
  }

  canSellShip(shipId: number): boolean {
    return this.isHumanTurn('awaitingMarket') && this.view!.canSellShip(shipId);
  }

  sellShip(shipId: number): void {
    if (this.canSellShip(shipId)) this.perform(['sellShip', shipId], () => this.engine!.sellShip(shipId));
  }

  finishMarket(): void {
    if (this.isHumanTurn('awaitingMarket')) this.perform(['finishMarket'], () => this.engine!.finishMarket());
  }

  /** A fleet's stop as the board shows it: its departure stop until it has sailed in. */
  shownPosition(player: Player): number {
    const sailing = this.departure?.playerId === player.id && this.state?.phase === 'moving';
    return sailing ? this.departure!.position : player.position;
  }

  get muted(): boolean {
    return isMuted();
  }

  toggleMute(): void {
    setMuted(!isMuted());
    this.changed();
  }

  setVolume(channel: SoundChannel, value: number): void {
    setVolume(channel, value);
    this.changed();
  }

  /** Starts the soundtrack and waves; browsers only allow it from a user gesture. */
  startSoundtrack(): void {
    startSoundtrack();
  }

  islandsOwnedBy(playerId: number): number {
    return this.view?.islandsOwnedBy(playerId) ?? 0;
  }

  netWorth(playerId: number): number {
    return this.view?.netWorth(playerId) ?? 0;
  }

  subscribe = (callback: () => void): (() => void) => {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  };

  getVersion = (): number => this.version;

  private onEngineEvent(event: GameEvent): void {
    const engine = this.engine;
    const view = this.view!;
    const { state } = view;
    if (this.holdsLotteryResult(event, view)) return;
    this.feedback.observe(event, state);
    const players = state.players;
    const isHuman = (id: number) => !players[id].isAI;
    const isViewer = (id: number) => id === this.viewerId;
    EventBus.emit('engine-event', event);
    switch (event.type) {
      case 'seaEvent': {
        const id = ++this.noticeId;
        this.seaNotices = [{
          id, event, playerName: players[event.playerId].name,
          destination: event.destination === undefined ? undefined : state.map[event.destination].name,
        }, ...this.seaNotices];
        for (const notice of this.seaNotices.slice(SEA_NOTICE_LIMIT)) {
          clearTimeout(this.noticeTimers.get(notice.id));
          this.noticeTimers.delete(notice.id);
        }
        this.seaNotices = this.seaNotices.slice(0, SEA_NOTICE_LIMIT);
        this.noticeTimers.set(id, setTimeout(() => this.dismissSeaNotice(id), SEA_NOTICE_DURATION_MS));
        const fought = event.outcome === 'victory' || event.outcome === 'defeat' || event.outcome === 'damaged' || event.outcome === 'sunk';
        if (event.event === 'merchant' && event.outcome === 'accepted') sfx.sell();
        else if (event.event === 'pirates' && fought) sfx.cannon();
        else if ((event.gold ?? 0) > 0) sfx.coin();
        else if (event.outcome === 'damaged' || event.outcome === 'sunk' || event.outcome === 'defeat') sfx.storm();
        if (event.shipsLost?.length) sfx.splash();
        break;
      }
      case 'royalAudience':
        if (isViewer(event.audience.playerId)) this.headline = { text: event.audience.message, tone: 'gain', royal: true };
        break;
      case 'campaignMissionCompleted':
        this.headline = { text: `King’s mission complete: ${event.mission.description}. +${event.mission.reward}g`, tone: 'gain', royal: true };
        sfx.coin();
        break;
      case 'compassSpun':
        this.spinSequence += 1;
        this.departure = { playerId: event.playerId, position: players[event.playerId].position };
        if (isViewer(event.playerId)) this.headline = null;
        sfx.spin();
        break;
      case 'goldChanged':
        EventBus.emit('gold-changed', event);
        if (event.reason === 'royal salary' || event.reason === 'treasure' || event.reason === 'trade') sfx.coin();
        else if (event.reason === 'storm repairs') sfx.storm();
        break;
      case 'moved':
        this.pendingMove = { playerId: event.playerId, path: event.path, id: ++this.moveId };
        this.resumeMovement();
        break;
      case 'turnStarted':
        if (isHuman(event.playerId) && (engine || isViewer(event.playerId))) {
          this.skipping = false;
          if (engine && event.playerId !== this.viewerId) {
            this.handoffNote = this.headline && this.viewerId !== null && this.humanCount > 1 ? { ...this.headline, playerId: this.viewerId } : null;
            this.headline = null;
            this.viewerId = event.playerId;
            if (this.humanCount > 1) this.handoffTo = event.playerId;
          }
        }
        if (engine?.currentPlayer.isAI) this.later(() => {
          const round = engine.state.round;
          engine.decideForAI();
          if (engine.state.phase === 'awaitingSpin' && engine.currentPlayer.id === event.playerId && engine.state.round === round) this.beginSpin(engine);
        });
        break;
      case 'tollPaid': {
        const at = state.map[players[event.from].position].name;
        if (isViewer(event.to)) {
          this.headline = { text: `${players[event.from].name} pays you ${event.amount}g toll at ${at}!`, tone: 'gain' };
          sfx.coin();
        } else if (isViewer(event.from)) {
          this.headline = { text: `You pay ${players[event.to].name} ${event.amount}g toll at ${at}.`, tone: 'loss' };
          sfx.pay();
        } else {
          sfx.coin();
        }
        break;
      }
      case 'claimed': {
        const node = state.map[event.nodeId];
        if (isViewer(event.playerId)) this.headline = { text: `${node.name} is yours! Rivals now pay you ${node.toll}g here.`, tone: 'gain' };
        sfx.claim();
        break;
      }
      case 'shipAdded': {
        const ship = players[event.playerId].fleet.find((candidate) => candidate.id === event.shipId);
        if (isViewer(event.playerId) && ship) {
          this.headline = { text: `${ship.name} joined your fleet.`, tone: 'gain' };
          sfx.bell();
        }
        break;
      }
      case 'shipSold':
        if (isViewer(event.playerId)) {
          this.headline = { text: `Sold ${event.shipName} for ${event.price}g.`, tone: 'gain' };
          sfx.sell();
        }
        break;
      case 'barterTraded':
        if (isViewer(event.playerId)) sfx.barter();
        break;
      case 'cargoMoved':
        if (isViewer(event.playerId)) sfx.cargo();
        break;
      case 'battleFought': {
        const { report } = event;
        const at = state.map[report.nodeId].name;
        const rival = players[isViewer(report.attacker) ? report.defender : report.attacker].name;
        if (isViewer(report.attacker)) {
          this.headline = report.outcome === 'victory' ? { text: `Victory! You sink ${rival}'s defenders and take ${at}.`, tone: 'gain' }
            : report.outcome === 'defeat' ? { text: `Defeat at ${at}: your fleet is sunk and you pay ${report.tollPaid}g double toll.`, tone: 'loss' }
            : { text: `Stalemate at ${at}: both fleets sail home.`, tone: 'loss' };
        } else if (isViewer(report.defender)) {
          this.headline = report.outcome === 'victory' ? { text: `${rival} sinks your defenders and takes ${at}!`, tone: 'loss' }
            : report.outcome === 'defeat' ? { text: `You repel ${rival} at ${at} and collect ${report.tollPaid}g double toll!`, tone: 'gain' }
            : { text: `${rival} attacks ${at}; the battle is a draw and both fleets sail home.`, tone: 'loss' };
        }
        const won = isViewer(report.defender) ? report.outcome === 'defeat' : report.outcome === 'victory';
        sfx.battle(report.rounds, report.attackerSunk.length + report.defenderSunk.length, won ? 'victory' : 'loss');
        break;
      }
      case 'lotteryOpened':
        if (engine && isHuman(event.playerId)) {
          clearInterval(this.lotteryClock);
          let lastTick = Date.now();
          this.lotteryClock = setInterval(() => {
            if (this.engine !== engine || engine.state.phase !== 'awaitingLottery') return clearInterval(this.lotteryClock);
            const elapsed = Math.floor((Date.now() - lastTick) / 1000);
            if (elapsed < 1) return;
            lastTick += elapsed * 1000;
            engine.advanceLotteryClock(elapsed);
            this.changed();
          }, 250);
        }
        if (this.canHelm) this.skipping = false;
        if (engine?.currentPlayer.isAI) this.later(() => engine.decideForAI());
        break;
      case 'lotteryDrawn': {
        clearInterval(this.lotteryClock);
        const { draw } = event;
        if (isViewer(draw.playerId)) {
          const matched = `${draw.matches.length} match${draw.matches.length === 1 ? '' : 'es'}`;
          this.headline = draw.prize
            ? { text: `Lottery: ${matched}! You win ${draw.prize}g.`, tone: 'gain' }
            : { text: `Lottery: ${draw.picks.length ? matched : 'no numbers bought'}. No prize this time.`, tone: 'loss' };
          if (draw.prize) sfx.win();
        }
        break;
      }
      case 'mistDuelResolved':
        if (isHuman(event.result.playerId) && event.result.outcome === 'win') sfx.win();
        break;
      case 'tollOffered':
      case 'claimOffered':
      case 'marketOffered':
      case 'merchantOffered':
      case 'wyvernOffered':
      case 'barterOffered':
      case 'recruitsOffered':
      case 'mistOffered':
      case 'buildOffered':
      case 'cargoMarketOpened':
        if (this.canHelm) this.skipping = false;
        if (engine?.currentPlayer.isAI) this.later(() => engine.decideForAI());
        break;
      case 'marketTrade':
        if (isViewer(event.playerId)) {
          const sold = event.side === 'sell';
          this.headline = { text: `${sold ? 'Sold' : 'Bought'} ${event.quantity} ${event.good} for ${event.total}g.`, tone: sold ? 'gain' : 'loss' };
          if (sold) sfx.sell();
          else sfx.buy();
        }
        break;
      case 'gameOver':
        if (isHuman(event.winner)) sfx.win();
        // Fall through: a completed or failed stage stops all game timers.
      case 'campaignFailed':
        this.skipping = false;
        this.clearTimers();
        break;
    }
    if (engine) this.changed();
  }

  private isHumanTurn(phase: GameState['phase']): boolean {
    return this.state?.phase === phase && this.canHelm;
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

  /** Delay between balls leaving the jar in the lottery reveal. */
  get lotteryBallDelay(): number {
    return this.timings.step * 3;
  }

  /** How long the human's drawn balls take to land in the jar; 0 at Instant speed. */
  get lotteryRevealDelay(): number {
    return this.timings.step === 0 ? 0 : (LOTTERY.drawn - 1) * this.lotteryBallDelay + LOTTERY_BALL_DROP_MS;
  }

  /** The ship's log as the player may see it: a held lottery result stays hidden until the last ball lands. */
  visibleLog(state: GameState): string[] {
    return this.lotteryHeld ? state.log.slice(0, this.lotteryHeld.logCut) : state.log;
  }

  /** A player's treasury as shown, without a lottery prize that is still being drawn. */
  displayGold(player: Player): number {
    return player.gold - (this.lotteryHeld?.draw.playerId === player.id ? this.lotteryHeld.draw.prize : 0);
  }

  private holdsLotteryResult(event: GameEvent, view: GameView): boolean {
    const draw = view.state.lottery?.draw;
    const result = event.type === 'lotteryDrawn' || (event.type === 'goldChanged' && event.reason === 'lottery prize');
    if (!draw || !result || this.lotteryShown === draw || view.state.players[draw.playerId].isAI ||
        (this.room && draw.playerId !== this.viewerId) || this.lotteryRevealDelay === 0) return false;
    if (this.lotteryHeld?.draw !== draw) {
      clearInterval(this.lotteryClock);
      clearTimeout(this.lotteryReveal);
      this.lotteryRevealed = false;
      this.lotteryHeld = { draw, logCut: view.state.log.length - 1, events: [] };
      this.lotteryReveal = setTimeout(() => this.revealLottery(view), this.lotteryRevealDelay + LOTTERY_REVEAL_GRACE_MS);
    }
    this.lotteryHeld.events.push(event);
    return true;
  }

  /** The lottery panel's last ball finished dropping into the jar. */
  lotteryBallsLanded(): void {
    if (this.view) this.revealLottery(this.view);
  }

  private revealLottery(view: GameView): void {
    const held = this.lotteryHeld;
    if (!held || this.view !== view) return;
    clearTimeout(this.lotteryReveal);
    this.lotteryHeld = null;
    this.lotteryShown = held.draw;
    this.lotteryRevealed = true;
    for (const event of held.events) this.onEngineEvent(event);
    this.changed();
  }

  private clearTimers(): void {
    clearTimeout(this.timer);
    clearInterval(this.lotteryClock);
    clearTimeout(this.lotteryReveal);
    this.lotteryRevealed = true;
    this.lotteryHeld = null;
    this.pending = null;
  }

  private changed(): void {
    this.version += 1;
    this.subscribers.forEach((callback) => callback());
    EventBus.emit('state-changed');
  }
}

export const gameController = new GameController();
