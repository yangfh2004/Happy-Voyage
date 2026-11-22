import { tx } from '@happy-voyage/shared';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '@happy-voyage/shared';

vi.mock('./EventBus', () => {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  return { EventBus: {
    on: (name: string, fn: (...args: unknown[]) => void) => listeners.set(name, [...(listeners.get(name) ?? []), fn]),
    emit: (name: string, ...args: unknown[]) => listeners.get(name)?.forEach((fn) => fn(...args)),
    removeAllListeners: () => listeners.clear(),
  } };
});

import { EventBus } from './EventBus';
import { GameController } from './GameController';
import { createNationRoster } from '@happy-voyage/shared';

const players = [
  { name: 'Human', color: 0, isAI: false },
  { name: 'AI', color: 1, isAI: true },
];
let controller: GameController;
let storage: Map<string, string>;
let moveId: number;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  EventBus.removeAllListeners();
  controller = new GameController();
  EventBus.on('animate-move', (move: { id: number }) => { moveId = move.id; });
});

afterEach(() => {
  controller.quit();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function humanTurn() {
  controller.spinCompass();
  controller.finishSpin(controller.spinId);
  EventBus.emit('move-complete', moveId);
  if (controller.state?.phase === 'awaitingClaim') controller.decline();
}

it('tags only the compass movement for route dots, not later Wyvern flights', () => {
  const moves = vi.fn();
  EventBus.on('animate-move', moves);
  controller.newGame(players);
  const origin = controller.state!.players[0].position;
  controller.spinCompass();
  controller.finishSpin(controller.spinId);
  expect(moves).toHaveBeenLastCalledWith(expect.objectContaining({ sailFrom: origin }));
  controller.newGame(players);
  const state = controller.state!;
  state.players[0].strategies = ['navigate'];
  const wyvern = state.map.find(n => n.event === 'openSea')!;
  wyvern.event = 'wyvern';
  controller.useStrategy('navigate', wyvern.id);
  expect(state.phase).toBe('awaitingWyvern');
  controller.wyvernFly(2);
  expect(moves).toHaveBeenLastCalledWith(expect.objectContaining({ path: [2], sailFrom: undefined }));
});

it('publishes a compass target through sailing and clears it on arrival', () => {
  controller.newGame(players);
  const state = controller.state!;
  expect(controller.landingTarget).toBeNull();
  controller.spinCompass();
  const target = controller.landingTarget!;
  expect(target.steps).toBe(2);
  expect(target.nodeId).toBe((state.players[0].position + 2) % state.map.length);
  controller.finishSpin(controller.spinId);
  expect(controller.landingTarget).toEqual(target);
  EventBus.emit('move-complete', moveId);
  expect(controller.landingTarget).toBeNull();
});

it('clears Navigate previews on its immediate landing without inventing a compass roll', () => {
  controller.newGame(players);
  const state = controller.state!;
  const target = state.map.find((node) => node.kind === 'island')!.id;
  state.players[0].strategies = ['navigate'];
  controller.useStrategy('navigate', target);
  expect(state.players[0].position).toBe(target);
  expect(state.phase).toBe('awaitingClaim');
  expect(state.lastSpin).toBeNull();
  expect(controller.landingTarget).toBeNull();
});

it('routes recruitment and decline actions only during human recruiting visits', () => {
  controller.newGame(players);
  const state = controller.state!;
  const p = state.players[0];
  controller.recruitCaptain(0);
  expect(p.captains).toEqual([]);
  const visit = () => {
    state.currentPlayer = 0;
    state.phase = 'awaitingSpin';
    p.position = state.map.find((node) => node.special === 'dragonSnake')!.id - 2;
    state.wind.direction = 'S';
    humanTurn();
    expect(state.phase).toBe('awaitingRecruit');
  };
  visit();
  const gold = p.gold;
  controller.recruitCaptain(0);
  expect(p.captains).toEqual(['ines']);
  expect(p.gold).toBe(gold - 180);
  expect(state.pendingRecruits).toBeNull();
  visit();
  controller.decline();
  expect(state.pendingRecruits).toBeNull();
  expect(p.captains).toEqual(['ines']);
});

it('announces a home promotion until the next human spin', () => {
  controller.newGame(players);
  const state = controller.state!;
  const p = state.players[0];
  state.owners[state.map.find((node) => node.kind === 'island')!.id] = 0;
  p.position = (p.homePort - 2 + state.map.length) % state.map.length;
  humanTurn();
  expect(p.rank).toBe(1);
  expect(controller.headline).toMatchObject({ royal: true, tone: 'gain' });
  expect(controller.headline?.text).toContain('Knight (骑士)');
  state.currentPlayer = 0;
  state.phase = 'awaitingSpin';
  controller.spinCompass();
  expect(controller.headline).toBeNull();
});

it('offers the human build menu and guards build actions outside the visit', () => {
  controller.newGame(players);
  const state = controller.state!;
  state.owners[2] = 0;
  controller.build('lumberMill');
  expect(state.buildings[2]).toEqual({});
  controller.spinCompass();
  controller.finishSpin(controller.spinId);
  EventBus.emit('move-complete', moveId);
  expect(state.phase).toBe('awaitingBuild');
  expect(controller.canBuild('lumberMill')).toBe(true);
  controller.build('lumberMill');
  controller.build('lumberMill');
  expect(state.buildings[2].lumberMill).toBe(2);
  state.players[0].gold = 0;
  controller.build('shipyard');
  expect(state.buildings[2].shipyard).toBeUndefined();
  controller.finishBuilding();
  expect(state.currentPlayer).toBe(1);
});

it('launches a ship during a human colony visit and announces its arrival', () => {
  controller.newGame(players);
  const state = controller.state!;
  state.owners[2] = 0;
  state.buildings[2].shipyard = 1;
  state.stockpiles[2] = { lumber: 2, iron: 1, specialties: {} };
  controller.buildShip('explorer');
  expect(state.players[0].fleet).toHaveLength(5);

  humanTurn();
  expect(controller.canBuildShip('explorer')).toBe(true);
  controller.buildShip('explorer');
  controller.buildShip('explorer');
  expect(state.players[0].fleet).toHaveLength(6);
  expect(state.players[0].fleet.at(-1)?.type).toBe('explorer');
  expect(controller.headline?.text).toBe(`${state.players[0].fleet.at(-1)?.name} joined your fleet.`);
  expect(controller.canBuildShip('explorer')).toBe(false);
});

it('buys and sells ships through the controller at an owned colony', () => {
  controller.newGame(players);
  const state = controller.state!;
  state.owners[2] = 0;
  humanTurn();
  const player = state.players[0];
  const count = player.fleet.length;
  expect(controller.canBuyUsedShip('explorer')).toBe(true);
  controller.buyUsedShip('explorer');
  expect(player.fleet).toHaveLength(count + 1);
  const ship = player.fleet.at(-1)!;
  expect(controller.canSellShip(ship.id)).toBe(true);
  controller.sellShip(ship.id);
  expect(player.fleet).toHaveLength(count);
  expect(state.phase).toBe('awaitingBuild');
  controller.finishBuilding();
  expect(controller.canBuyUsedShip('cargo')).toBe(false);
});

describe('pacing', () => {
  it('replaces the purchase headline with the ship sale and its proceeds', () => {
    controller.newGame(players);
    const state = controller.state!;
    state.map[2] = { ...state.map[2], kind: 'special', special: 'skeleton' };
    humanTurn();
    expect(state.phase).toBe('awaitingMarket');
    controller.buyUsedShip('explorer');
    const ship = state.players[0].fleet.at(-1)!;
    expect(controller.headline?.text).toBe(`${ship.name} joined your fleet.`);
    controller.sellShip(ship.id);
    expect(controller.headline).toMatchObject({ text: `Sold ${ship.name} for 54g.`, tone: 'gain' });
    controller.sellShip(ship.id);
    expect(controller.headline?.text).toBe(`Sold ${ship.name} for 54g.`);
  });
  it('replays a move lost before scene startup and clears it after landing', () => {
    controller.newGame(players);
    controller.spinCompass();
    controller.finishSpin(controller.spinId);
    const replay = vi.fn();
    EventBus.on('animate-move', replay);
    controller.resumeMovement();
    expect(replay).toHaveBeenCalledWith(expect.objectContaining({ id: moveId, path: [1, 2] }));
    EventBus.emit('move-complete', moveId);
    replay.mockClear();
    controller.resumeMovement();
    expect(replay).not.toHaveBeenCalled();
    expect(controller.state?.phase).toBe('awaitingClaim');
  });

  it('does not replay a previous voyage after restarting or quitting', () => {
    controller.newGame(players);
    controller.spinCompass();
    controller.finishSpin(controller.spinId);
    controller.newGame(players);
    const replay = vi.fn();
    EventBus.on('animate-move', replay);
    controller.resumeMovement();
    controller.quit();
    controller.resumeMovement();
    expect(replay).not.toHaveBeenCalled();
  });
  it('waits for a human wyvern destination without advancing the turn', () => {
    controller.newGame(players);
    const state = controller.state!;
    state.map[2] = { ...state.map[2], kind: 'event', event: 'wyvern' };
    controller.spinCompass();
    controller.finishSpin(controller.spinId);
    EventBus.emit('move-complete', moveId);
    expect(state.phase).toBe('awaitingWyvern');
    expect(state.pendingWyvern).toBe(true);
    expect(state.currentPlayer).toBe(0);
    expect(state.players[0].position).toBe(2);
  });
  it('defaults to Normal and persists/restores valid choices', () => {
    expect(controller.speed).toBe('Normal');
    controller.setSpeed('Fast');
    expect(new GameController().speed).toBe('Fast');
    storage.set('happy-voyage-speed', 'bogus');
    expect(new GameController().speed).toBe('Normal');
  });

  it('works when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    });
    const other = new GameController();
    expect(other.speed).toBe('Normal');
    expect(() => other.setSpeed('Instant')).not.toThrow();
  });

  it('reschedules an in-flight AI delay without spinning twice', async () => {
    controller.newGame(players);
    controller.state!.players[1].strategies = [];
    humanTurn();
    expect(controller.state?.currentPlayer).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    controller.setSpeed('Fast');
    await vi.advanceTimersByTimeAsync(149);
    expect(controller.state?.phase).toBe('awaitingSpin');
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.state?.phase).toBe('spinning');
    expect(controller.timings.spin).toBe(500);
    controller.finishSpin(controller.spinId);
    expect(controller.state?.phase).toBe('moving');
    await vi.advanceTimersByTimeAsync(1000);
    expect(controller.state?.phase).toBe('moving');
  });

  it('skips AI actions, restores chosen speed, and stops at the human spin', async () => {
    controller.setSpeed('Fast');
    controller.newGame(players);
    humanTurn();
    controller.skipToMyTurn();
    expect(controller.timings.step).toBe(0);
    await vi.runOnlyPendingTimersAsync();
    EventBus.emit('move-complete', moveId);
    await vi.runAllTimersAsync();
    expect(controller.state?.round).toBe(2);
    expect(controller.state?.currentPlayer).toBe(0);
    expect(controller.state?.phase).toBe('awaitingSpin');
    expect(controller.timings).toEqual({ ai: 250, step: 70, spin: 500 });
    expect(storage.get('happy-voyage-speed')).toBe('Fast');
  });

  it('stops skipping at a human claim decision and ignores duplicate completions', () => {
    controller.newGame(players);
    controller.spinCompass();
    controller.finishSpin(controller.spinId);
    controller.skipToMyTurn();
    EventBus.emit('move-complete', moveId);
    expect(controller.state?.phase).toBe('awaitingClaim');
    expect(controller.waiting).toBe(false);
    expect(controller.timings.step).toBe(200);
    EventBus.emit('move-complete', moveId);
    expect(controller.state?.phase).toBe('awaitingClaim');
  });

  it('can skip an active spin without waiting for its animation or sailing twice', () => {
    controller.newGame(players);
    controller.spinCompass();
    expect(controller.state?.phase).toBe('spinning');
    expect(controller.waiting).toBe(true);
    expect(controller.state?.players[0].position).toBe(0);
    const spinId = controller.spinId;
    controller.skipToMyTurn();
    expect(controller.state?.phase).toBe('moving');
    expect(controller.timings.spin).toBe(0);
    const skippedMoveId = moveId;
    controller.finishSpin(spinId);
    expect(moveId).toBe(skippedMoveId);
    EventBus.emit('move-complete', skippedMoveId);
    expect(controller.state?.phase).toBe('awaitingClaim');
    expect(controller.timings.spin).toBe(1400);
  });

  it('uses the selected speed for an in-progress spin, including Instant', () => {
    controller.newGame(players);
    controller.spinCompass();
    expect(controller.timings.spin).toBe(1400);
    controller.setSpeed('Fast');
    expect(controller.timings.spin).toBe(500);
    expect(controller.state?.phase).toBe('spinning');
    controller.setSpeed('Instant');
    expect(controller.timings.spin).toBe(0);
    expect(controller.state?.phase).toBe('moving');
    expect(controller.state?.lastSpin).toBe(2);
  });

  it('ignores obsolete movement and timers after starting a new game', async () => {
    controller.newGame(players);
    humanTurn();
    const oldId = moveId;
    const oldSpinId = controller.spinId;
    controller.newGame(players);
    controller.spinCompass();
    controller.finishSpin(oldSpinId);
    expect(controller.state?.phase).toBe('spinning');
    controller.finishSpin(controller.spinId);
    EventBus.emit('move-complete', oldId);
    await vi.runAllTimersAsync();
    expect(controller.state?.currentPlayer).toBe(0);
    expect(controller.state?.phase).toBe('moving');
    EventBus.emit('move-complete', moveId);
    expect(controller.state?.phase).toBe('awaitingClaim');
  });

  it('ignores skip without a game or at a human decision', () => {
    controller.skipToMyTurn();
    expect(controller.waiting).toBe(false);
    controller.newGame(players);
    controller.skipToMyTurn();
    expect(controller.timings.step).toBe(200);
  });

  it('does not skip past game over', async () => {
    controller.newGame(players);
    const state = controller.state!;
    state.players[1].bankrupt = true;
    controller.spinCompass();
    controller.finishSpin(controller.spinId);
    controller.skipToMyTurn();
    EventBus.emit('move-complete', moveId);
    if (state.phase === 'awaitingClaim') controller.decline();
    await vi.runAllTimersAsync();
    expect(state.phase).toBe('gameOver');
    expect(controller.waiting).toBe(false);
    expect(controller.timings.step).toBe(200);
  });
});

it('runs the Treasure Island timer for the human and draws when it runs out', () => {
  controller.newGame(players);
  const state = controller.state!;
  const p = state.players[0];
  const treasure = state.map.find((node) => node.special === 'treasure')!;
  p.position = (treasure.id - 2 + state.map.length) % state.map.length;
  humanTurn();
  expect(state.phase).toBe('awaitingLottery');
  controller.buyLotteryNumber(7);
  expect(state.lottery!.picks).toEqual([7]);
  const seconds = state.lottery!.secondsLeft;
  vi.advanceTimersByTime(1000);
  expect(state.lottery!.secondsLeft).toBe(seconds - 1);
  vi.setSystemTime(Date.now() + 5000);
  vi.advanceTimersByTime(250);
  expect(state.lottery!.secondsLeft).toBe(seconds - 6);
  vi.advanceTimersByTime((seconds - 6) * 1000);
  expect(state.lottery!.draw).not.toBeNull();
  expect(state.lotteryDraws).toHaveLength(1);
  controller.finishLottery();
  expect(state.phase).toBe('awaitingLottery');
  vi.advanceTimersByTime(10_000);
  expect(controller.lotteryRevealed).toBe(true);
  expect(controller.headline?.text).toContain('Lottery');
  controller.finishLottery();
  expect(state.lottery).toBeNull();
  expect(state.currentPlayer).toBe(1);
});

it('keeps the lottery prize, log line and toast hidden until the last ball lands', () => {
  controller.newGame(players);
  const state = controller.state!;
  const p = state.players[0];
  const treasure = state.map.find((node) => node.special === 'treasure')!;
  p.position = (treasure.id - 2 + state.map.length) % state.map.length;
  humanTurn();
  expect(state.phase).toBe('awaitingLottery');
  for (let n = 1; n <= 5; n++) controller.buyLotteryNumber(n);
  const before = controller.displayGold(p);
  const logBefore = controller.visibleLog(state).length;
  const toasts: GameEvent[] = [];
  const onGold = (event: GameEvent) => toasts.push(event);
  EventBus.on('gold-changed', onGold);
  controller.drawLottery();
  const { prize } = state.lottery!.draw!;
  expect(prize).toBeGreaterThan(0);
  expect(p.gold).toBe(before + prize);
  expect(controller.displayGold(p)).toBe(before);
  expect(controller.visibleLog(state)).toHaveLength(logBefore);
  expect(toasts).toHaveLength(0);
  expect(controller.headline?.text ?? '').not.toContain('Lottery');
  vi.advanceTimersByTime(controller.lotteryRevealDelay);
  expect(controller.lotteryRevealed).toBe(false);
  controller.lotteryBallsLanded();
  expect(controller.lotteryRevealed).toBe(true);
  expect(controller.displayGold(p)).toBe(before + prize);
  expect(controller.visibleLog(state).at(-1)).toContain('Treasure Island draws');
  expect(toasts).toEqual([expect.objectContaining({ type: 'goldChanged', reason: 'lottery prize', delta: prize })]);
  expect(controller.headline?.text).toContain(`You win ${prize}g`);
});

it('shows the lottery result at once at Instant speed', () => {
  controller.newGame(players);
  controller.setSpeed('Instant');
  const state = controller.state!;
  const p = state.players[0];
  const treasure = state.map.find((node) => node.special === 'treasure')!;
  p.position = (treasure.id - 2 + state.map.length) % state.map.length;
  humanTurn();
  controller.buyLotteryNumber(1);
  controller.drawLottery();
  expect(controller.lotteryRevealed).toBe(true);
  expect(controller.displayGold(p)).toBe(p.gold);
  expect(controller.visibleLog(state)).toBe(state.log);
  expect(controller.headline?.text).toContain('Lottery');
});

it('reveals a held lottery result on a fallback timer if the last ball never reports landing', () => {
  controller.newGame(players);
  const state = controller.state!;
  const treasure = state.map.find((node) => node.special === 'treasure')!;
  state.players[0].position = (treasure.id - 2 + state.map.length) % state.map.length;
  humanTurn();
  controller.buyLotteryNumber(1);
  controller.drawLottery();
  expect(controller.lotteryRevealed).toBe(false);
  vi.advanceTimersByTime(controller.lotteryRevealDelay + 500);
  expect(controller.lotteryRevealed).toBe(true);
  expect(controller.headline?.text).toContain('Lottery');
});

describe('local multiplayer', () => {
  it.each([['Normal', 1000], ['Fast', 350], ['Instant', 0]] as const)('announces turns at %s speed for %s ms', async (speed, duration) => {
    controller.setSpeed(speed);
    controller.newGame(players);
    expect(controller.turnNoticeDuration).toBe(duration);
    expect(controller.turnNotice !== null).toBe(duration > 0);
    if (duration > 0) {
      await vi.advanceTimersByTimeAsync(duration - 1);
      expect(controller.turnNotice).not.toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      expect(controller.turnNotice).toBeNull();
    }
  });

  it('clears the compass on handover and explains an AI Navigate instead of a spin', async () => {
    controller.newGame(createNationRoster([{ name: 'Human', nation: 'Spain' }], { totalPlayers: 4 }));
    const state = controller.state!;
    for (const player of state.players) player.strategies = [];
    const islands = state.map.filter((node) => node.kind === 'island');
    state.players[0].position = (islands[0].id - 2 + state.map.length) % state.map.length;
    state.players[1].strategies = ['navigate'];
    humanTurn();
    expect(state.currentPlayer).toBe(1);
    expect(state.lastSpin).toBeNull();
    await vi.advanceTimersByTimeAsync(700);
    expect(state.lastSpin).toBeNull();
    expect(controller.turnAction).toMatchObject({ en: '{p} used Navigate to {n}.' });
    controller.setSpeed('Instant');
    expect(controller.turnAction).toBeNull();
    expect(controller.turnNotice).toBeNull();
  });

  it('clears the previous Navigate notice and cancels its timer when the next turn starts', async () => {
    const setTimer = vi.spyOn(globalThis, 'setTimeout');
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout');
    controller.newGame(createNationRoster([{ name: 'Human', nation: 'Spain' }], { totalPlayers: 4 }));
    const state = controller.state!;
    for (const player of state.players) player.strategies = [];
    const island = state.map.find((node) => node.kind === 'island')!;
    state.players[0].position = (island.id - 2 + state.map.length) % state.map.length;
    state.players[1].strategies = ['navigate'];
    humanTurn();
    await vi.advanceTimersByTimeAsync(700);
    expect(state.currentPlayer).toBe(1);
    expect(controller.turnAction).not.toBeNull();
    const timerIndex = setTimer.mock.calls.map(([, delay]) => delay).lastIndexOf(1000);
    const actionTimer = setTimer.mock.results[timerIndex].value;
    clearTimer.mockClear();

    await vi.advanceTimersByTimeAsync(700);
    expect(state.currentPlayer).toBe(2);
    expect(controller.turnNotice).toMatchObject({ params: { p: { id: 2 } } });
    expect(controller.turnAction).toBeNull();
    expect(clearTimer).toHaveBeenCalledWith(actionTimer);
    await vi.advanceTimersByTimeAsync(300);
    expect(controller.turnAction).toBeNull();
    expect(controller.turnNotice).not.toBeNull();
  });

  it('holds each of three AI seats for its own compass and sailing completion at Normal speed', async () => {
    controller.setSpeed('Normal');
    controller.newGame(createNationRoster([{ name: 'Human', nation: 'Spain' }], { totalPlayers: 4 }));
    const state = controller.state!;
    const islands = state.map.filter((node) => node.kind === 'island');
    for (const player of state.players) {
      player.strategies = [];
      player.position = (islands[player.id].id - 2 + state.map.length) % state.map.length;
    }
    humanTurn();
    for (const seat of [1, 2, 3]) {
      expect(state.currentPlayer).toBe(seat);
      expect(state.phase).toBe('awaitingSpin');
      await vi.advanceTimersByTimeAsync(699);
      expect(state.phase).toBe('awaitingSpin');
      await vi.advanceTimersByTimeAsync(1);
      expect(state.phase).toBe('spinning');
      await vi.advanceTimersByTimeAsync(5000);
      expect(state.currentPlayer).toBe(seat);
      expect(state.phase).toBe('spinning');
      controller.finishSpin(controller.spinId);
      expect(state.phase).toBe('moving');
      await vi.advanceTimersByTimeAsync(5000);
      expect(state.currentPlayer).toBe(seat);
      expect(state.phase).toBe('moving');
      EventBus.emit('move-complete', moveId);
      await vi.advanceTimersByTimeAsync(700);
    }
    expect(state.log.filter((line) => line.includes(' spins '))).toHaveLength(4);
  });

  const roster = () => createNationRoster([
    { name: 'Ana', nation: 'Spain' },
    { name: 'Bo', nation: 'China' },
    { name: 'Cy', nation: 'Japan' },
  ]);

  function finishHumanTurn() {
    controller.spinCompass();
    controller.finishSpin(controller.spinId);
    EventBus.emit('move-complete', moveId);
    const state = controller.state!;
    if (state.phase === 'awaitingClaim') controller.decline();
    else if (state.phase === 'awaitingBuild') controller.finishBuilding();
    else if (state.phase === 'awaitingToll') controller.payToll();
  }

  it('pauses for a device handoff between different humans and speaks to the seat at the helm', () => {
    controller.newGame(roster());
    const state = controller.state!;
    expect(controller.humanCount).toBe(3);
    expect(controller.handoffTo).toBeNull();
    expect(controller.viewerId).toBe(0);
    finishHumanTurn();
    expect(state.currentPlayer).toBe(1);
    expect(controller.handoffTo).toBe(1);
    expect(controller.viewerId).toBe(1);
    controller.spinCompass();
    expect(state.phase).toBe('awaitingSpin');
    controller.confirmHandoff();
    expect(controller.handoffTo).toBeNull();
    controller.spinCompass();
    expect(state.phase).toBe('spinning');
  });

  it('carries the outgoing human\'s last headline onto the pass-the-device screen', () => {
    controller.newGame(roster());
    controller.spinCompass();
    controller.finishSpin(controller.spinId);
    EventBus.emit('move-complete', moveId);
    controller.headline = { text: 'Azores is yours!', message: tx('Azores is yours!', '亚速尔群岛归你了！'), tone: 'gain' };
    const state = controller.state!;
    if (state.phase === 'awaitingClaim') controller.decline();
    else if (state.phase === 'awaitingBuild') controller.finishBuilding();
    else if (state.phase === 'awaitingToll') controller.payToll();
    expect(state.currentPlayer).toBe(1);
    expect(controller.headline).toBeNull();
    expect(controller.handoffNote).toMatchObject({ playerId: 0, tone: 'gain' });
    controller.confirmHandoff();
    expect(controller.handoffNote).toBeNull();
  });

  it('runs AI seats for every unpicked nation and returns to the first human after a full round', async () => {
    controller.newGame(roster());
    const state = controller.state!;
    expect(state.players.filter((p) => p.isAI)).toHaveLength(7);
    for (const seat of [0, 1, 2]) {
      expect(state.currentPlayer).toBe(seat);
      controller.confirmHandoff();
      finishHumanTurn();
    }
    controller.setSpeed('Instant');
    for (let i = 0; i < 200 && state.players[state.currentPlayer].isAI; i++) {
      await vi.advanceTimersByTimeAsync(10);
      if (state.phase === 'moving') EventBus.emit('move-complete', moveId);
    }
    expect(state.round).toBe(2);
    expect(state.players[state.currentPlayer].isAI).toBe(false);
    expect(controller.handoffTo).toBe(state.currentPlayer);
    expect(controller.awaitingHandoff).toBe(true);
  });

  it('keeps a solo game free of handoffs', () => {
    controller.newGame(players);
    finishHumanTurn();
    expect(controller.handoffTo).toBeNull();
  });
});
