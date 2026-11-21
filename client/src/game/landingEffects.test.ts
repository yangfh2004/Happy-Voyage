import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { playLanding } from './landingEffects';

afterEach(() => vi.unstubAllGlobals());

function harness(reduced = false) {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) });
  const graphics = Array.from({ length: 4 }, () => ({ setDepth: vi.fn().mockReturnThis(), lineStyle: vi.fn().mockReturnThis(), strokeEllipse: vi.fn().mockReturnThis(), lineBetween: vi.fn().mockReturnThis(), destroy: vi.fn() }));
  let index = 0;
  const graphicsFactory = vi.fn(() => graphics[index++]);
  const add = vi.fn((_options: unknown) => ({ stop: vi.fn() }));
  const addCounter = vi.fn((_options: unknown) => ({ stop: vi.fn() }));
  const scene = { add: { graphics: graphicsFactory }, tweens: { add, addCounter } };
  const ship = { x: 100, y: 200, scaleY: .95, height: 124, setOrigin: vi.fn() };
  const complete = vi.fn();
  const effect = playLanding(scene as unknown as Phaser.Scene, ship as unknown as Phaser.GameObjects.Image, complete);
  return { graphics, graphicsFactory, add, addCounter, ship, complete, effect };
}

describe('shore landing effects', () => {
  it('draws a splash and three expanding rings at the hull, then cleans up in 780ms', () => {
    const h = harness();
    expect(h.graphicsFactory).toHaveBeenCalledTimes(4);
    expect(h.graphicsFactory).toHaveBeenCalledWith({ x: 100, y: 200 + 39 * .95 });
    for (let i = 0; i < 3; i++) expect(h.add.mock.calls[i][0]).toMatchObject({ scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 560, delay: i * 90 });
    expect(h.graphics[3].lineBetween).toHaveBeenCalledTimes(6);
    const counter = h.addCounter.mock.calls[0][0] as { duration: number; onUpdate(tween: { getValue(): number }): void; onComplete(): void };
    expect(counter.duration).toBe(780);
    counter.onUpdate({ getValue: () => .2 });
    expect(h.ship.setOrigin).toHaveBeenCalled();
    expect(h.add.mock.calls.every(([config]) => !('x' in (config as object)) && !('y' in (config as object)))).toBe(true);
    counter.onComplete();
    h.effect!.stop();
    for (const graphic of h.graphics) expect(graphic.destroy).toHaveBeenCalledOnce();
    expect(h.ship.setOrigin).toHaveBeenLastCalledWith(.5);
    expect(h.complete).toHaveBeenCalledOnce();
  });

  it('can cancel a settling ship before its next voyage', () => {
    const h = harness();
    h.effect!.stop();
    for (const tween of [...h.add.mock.results, ...h.addCounter.mock.results]) expect(tween.value.stop).toHaveBeenCalledOnce();
    expect(h.complete).toHaveBeenCalledOnce();
  });

  it('creates no graphics, tweens or settling motion under reduced motion', () => {
    const h = harness(true);
    expect(h.effect).toBeUndefined();
    expect(h.graphicsFactory).not.toHaveBeenCalled();
    expect(h.add).not.toHaveBeenCalled();
    expect(h.addCounter).not.toHaveBeenCalled();
    expect(h.ship.setOrigin).not.toHaveBeenCalled();
  });
});
