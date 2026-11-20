import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../EventBus', () => ({ EventBus: { emit: vi.fn() } }));
vi.mock('../GameController', () => ({ gameController: { timings: { step: 200 } } }));

import { OceanScene } from './OceanScene';
import { EventBus } from '../EventBus';
import { gameController } from '../GameController';

type Move = { playerId: number; path: number[]; id: number };
type SceneHarness = {
  animateMove(move: Move): void;
  updatePacing(): void;
  cancelMove(): void;
  syncFromState(): void;
};

let scene: SceneHarness;
let completions: (() => void)[];
let tweens: { stop: ReturnType<typeof vi.fn>; setTimeScale: ReturnType<typeof vi.fn> }[];
let ship: { setFlipX: ReturnType<typeof vi.fn>; setPosition: ReturnType<typeof vi.fn>; x: number };

beforeEach(() => {
  vi.clearAllMocks();
  gameController.timings.step = 200;
  Object.assign(gameController, { state: null });
  completions = [];
  tweens = [];
  ship = { x: 0, setFlipX: vi.fn(), setPosition: vi.fn() };
  scene = Object.assign(new OceanScene(), {
    following: false,
    ships: new Map([[0, ship]]),
    marker: { clear: vi.fn() },
    tweens: { add: (options: { onComplete(): void }) => {
      completions.push(options.onComplete);
      const tween = { stop: vi.fn(), setTimeScale: vi.fn() };
      tweens.push(tween);
      return tween;
    } },
  }) as unknown as SceneHarness;
});

describe('colony ownership', () => {
  function graphics() {
    return { clear: vi.fn(), lineStyle: vi.fn().mockReturnThis(), strokeCircle: vi.fn().mockReturnThis(), lineBetween: vi.fn().mockReturnThis(), fillStyle: vi.fn().mockReturnThis(), fillTriangle: vi.fn().mockReturnThis() };
  }

  it('draws contrasting owner rings and flags for claimed colonies only', () => {
    const flags = graphics();
    Object.assign(scene, { flags });
    Object.assign(ship, { setAlpha: vi.fn() });
    Object.assign(gameController, { state: {
      owners: [null, 0], players: [{ id: 0, color: 0xe85d4a, position: 1 }], currentPlayer: 0, phase: 'gameOver',
    } });
    scene.syncFromState();
    expect(flags.strokeCircle).toHaveBeenCalledTimes(2);
    expect(flags.lineStyle).toHaveBeenCalledWith(10, 0x06283d, 1);
    expect(flags.lineStyle).toHaveBeenCalledWith(6, 0xe85d4a, 1);
    expect(flags.fillTriangle).toHaveBeenCalledOnce();
  });

  it.each([null, { owners: [], players: [], phase: 'gameOver' }])('clears ownership without drawing when there are no colonies (%j)', (state) => {
    const flags = graphics();
    Object.assign(scene, { flags, ships: new Map() });
    Object.assign(gameController, { state });
    scene.syncFromState();
    expect(flags.clear).toHaveBeenCalledOnce();
    expect(flags.strokeCircle).not.toHaveBeenCalled();
  });
});

describe('movement pacing', () => {
  it('retimes active and subsequent steps, resolving exactly once', () => {
    scene.animateMove({ playerId: 0, path: [1, 2], id: 7 });
    expect(tweens[0].setTimeScale).toHaveBeenLastCalledWith(1);
    gameController.timings.step = 70;
    scene.updatePacing();
    expect(tweens[0].setTimeScale).toHaveBeenLastCalledWith(200 / 70);
    completions[0]();
    expect(tweens[1].setTimeScale).toHaveBeenLastCalledWith(200 / 70);
    completions[1]();
    completions[1]();
    expect(EventBus.emit).toHaveBeenCalledOnce();
    expect(EventBus.emit).toHaveBeenCalledWith('move-complete', 7);
  });

  it('jumps to destination when switching an active move to Instant', async () => {
    scene.animateMove({ playerId: 0, path: [1, 2, 3], id: 8 });
    gameController.timings.step = 0;
    scene.updatePacing();
    scene.updatePacing();
    expect(tweens[0].stop).toHaveBeenCalledOnce();
    await Promise.resolve();
    completions[0]();
    expect(ship.setPosition).toHaveBeenCalledOnce();
    expect(EventBus.emit).toHaveBeenCalledOnce();
    expect(EventBus.emit).toHaveBeenCalledWith('move-complete', 8);
  });

  it('completes an empty Instant path without creating a tween', async () => {
    gameController.timings.step = 0;
    scene.animateMove({ playerId: 0, path: [], id: 9 });
    await Promise.resolve();
    expect(tweens).toHaveLength(0);
    expect(EventBus.emit).toHaveBeenCalledOnce();
    expect(EventBus.emit).toHaveBeenCalledWith('move-complete', 9);
  });

  it('cancels obsolete queued completions when replacing a move', async () => {
    gameController.timings.step = 0;
    scene.animateMove({ playerId: 0, path: [1], id: 10 });
    scene.animateMove({ playerId: 0, path: [2], id: 11 });
    await Promise.resolve();
    expect(EventBus.emit).toHaveBeenCalledOnce();
    expect(EventBus.emit).toHaveBeenCalledWith('move-complete', 11);
  });

  it('cancels an active tween without resolving its old landing', () => {
    scene.animateMove({ playerId: 0, path: [1], id: 12 });
    scene.cancelMove();
    completions[0]();
    expect(tweens[0].stop).toHaveBeenCalledOnce();
    expect(EventBus.emit).not.toHaveBeenCalled();
  });

  it('follows a relocated ship when an Instant move finishes', async () => {
    const camera = { centerOn: vi.fn() };
    Object.assign(scene, { following: true, cameras: { main: camera } });
    gameController.timings.step = 0;
    scene.animateMove({ playerId: 0, path: [69], id: 13 });
    await Promise.resolve();
    expect(camera.centerOn).toHaveBeenCalledWith(...ship.setPosition.mock.calls[0]);
    expect(EventBus.emit).toHaveBeenCalledWith('move-complete', 13);
  });
});
