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
  controller.roll();
  EventBus.emit('move-complete', moveId);
  if (controller.state?.phase === 'awaitingClaim') controller.decline();
}

describe('pacing', () => {
  it('resolves a wyvern relocation with a new move ID before advancing the turn', () => {
    controller.newGame(players);
    const state = controller.state!;
    state.map[2] = { ...state.map[2], kind: 'event', event: 'wyvern' };
    controller.roll();
    const rollId = moveId;
    EventBus.emit('move-complete', rollId);
    expect(moveId).not.toBe(rollId);
    expect(state.phase).toBe('moving');
    expect(state.players[0].position).toBe(state.players[0].homePort);
    EventBus.emit('move-complete', rollId);
    expect(state.phase).toBe('moving');
    EventBus.emit('move-complete', moveId);
    expect(state.phase).toBe('awaitingRoll');
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

  it('reschedules an in-flight AI delay without double rolling', async () => {
    controller.newGame(players);
    humanTurn();
    expect(controller.state?.currentPlayer).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    controller.setSpeed('Fast');
    await vi.advanceTimersByTimeAsync(149);
    expect(controller.state?.phase).toBe('awaitingRoll');
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.state?.phase).toBe('moving');
    await vi.advanceTimersByTimeAsync(1000);
    expect(controller.state?.phase).toBe('moving');
  });

  it('skips AI actions, restores chosen speed, and stops at the human roll', async () => {
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
    expect(controller.state?.phase).toBe('awaitingRoll');
    expect(controller.timings).toEqual({ ai: 250, step: 70 });
    expect(storage.get('happy-voyage-speed')).toBe('Fast');
  });

  it('stops skipping at a human claim decision and ignores duplicate completions', () => {
    controller.newGame(players);
    controller.roll();
    controller.skipToMyTurn();
    EventBus.emit('move-complete', moveId);
    expect(controller.state?.phase).toBe('awaitingClaim');
    expect(controller.waiting).toBe(false);
    expect(controller.timings.step).toBe(200);
    EventBus.emit('move-complete', moveId);
    expect(controller.state?.phase).toBe('awaitingClaim');
  });

  it('ignores obsolete movement and timers after starting a new game', async () => {
    controller.newGame(players);
    humanTurn();
    const oldId = moveId;
    controller.newGame(players);
    controller.roll();
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
    controller.roll();
    controller.skipToMyTurn();
    EventBus.emit('move-complete', moveId);
    if (state.phase === 'awaitingClaim') controller.decline();
    await vi.runAllTimersAsync();
    expect(state.phase).toBe('gameOver');
    expect(controller.waiting).toBe(false);
    expect(controller.timings.step).toBe(200);
  });
});
