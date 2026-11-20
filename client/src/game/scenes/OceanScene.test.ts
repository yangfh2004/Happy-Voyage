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
};

let scene: SceneHarness;
let completions: (() => void)[];
let tweens: { stop: ReturnType<typeof vi.fn>; setTimeScale: ReturnType<typeof vi.fn> }[];
let ship: { setFlipX: ReturnType<typeof vi.fn>; setPosition: ReturnType<typeof vi.fn>; x: number };

beforeEach(() => {
  vi.clearAllMocks();
  gameController.timings.step = 200;
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
