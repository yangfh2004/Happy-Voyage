import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

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
    humanTurn();
    expect(state.phase).toBe('awaitingRecruit');
  };
  visit();
  const gold = p.gold;
  controller.recruitCaptain(0);
  expect(p.captains).toEqual(['ines']);
  expect(p.gold).toBe(gold - 90);
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
  expect(state.players[0].fleet).toHaveLength(3);

  humanTurn();
  expect(controller.canBuildShip('explorer')).toBe(true);
  controller.buildShip('explorer');
  controller.buildShip('explorer');
  expect(state.players[0].fleet).toHaveLength(4);
  expect(state.players[0].fleet.at(-1)?.type).toBe('explorer');
  expect(controller.headline?.text).toBe(`${state.players[0].fleet.at(-1)?.name} joined your fleet.`);
  expect(controller.canBuildShip('explorer')).toBe(false);
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
    expect(controller.headline).toEqual({ text: `Sold ${ship.name} for 54g.`, tone: 'gain' });
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
  it('resolves a wyvern relocation with a new move ID before advancing the turn', () => {
    controller.newGame(players);
    const state = controller.state!;
    state.map[2] = { ...state.map[2], kind: 'event', event: 'wyvern' };
    controller.spinCompass();
    controller.finishSpin(controller.spinId);
    const rollId = moveId;
    EventBus.emit('move-complete', rollId);
    expect(moveId).not.toBe(rollId);
    expect(controller.shownPosition(state.players[0])).toBe(2);
    expect(state.phase).toBe('moving');
    expect(state.players[0].position).toBe(state.players[0].homePort);
    EventBus.emit('move-complete', rollId);
    expect(state.phase).toBe('moving');
    EventBus.emit('move-complete', moveId);
    expect(state.phase).toBe('awaitingSpin');
    expect(state.currentPlayer).toBe(1);
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
    expect(controller.state?.currentPlayer).toBe(1);
    expect(controller.timings.step).toBe(0);
    EventBus.emit('move-complete', moveId);
    await vi.runAllTimersAsync();
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
