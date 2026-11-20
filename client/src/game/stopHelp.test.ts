import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { bindStopHelp, stopHelpPosition } from './stopHelp';

function help() {
  const handlers = new Map<string, (pointer: Partial<Phaser.Input.Pointer>) => void>();
  const target = { on: vi.fn() };
  target.on.mockImplementation((event, callback) => { handlers.set(event, callback); return target; });
  const show = vi.fn();
  const hide = vi.fn();
  bindStopHelp(target, show, hide);
  return { show, hide, fire: (event: string, wasTouch: boolean, distance = 0) => handlers.get(event)!({ wasTouch, getDistance: () => distance }) };
}

describe('map stop help', () => {
  it('keeps mouse hover behavior without opening on mouse clicks alone', () => {
    const h = help();
    h.fire('pointerover', false);
    h.fire('pointerout', false);
    h.fire('pointerup', false);
    expect(h.show).toHaveBeenCalledOnce();
    expect(h.hide).toHaveBeenCalledOnce();
  });
  it('opens on a touch tap and stays open after the finger leaves', () => {
    const h = help();
    h.fire('pointerover', true);
    expect(h.show).not.toHaveBeenCalled();
    h.fire('pointerup', true, 2);
    h.fire('pointerout', true);
    expect(h.show).toHaveBeenCalledOnce();
    expect(h.hide).not.toHaveBeenCalled();
  });
  it('does not mistake a touch drag for a tap', () => {
    const h = help();
    h.fire('pointerup', true, 40);
    expect(h.show).not.toHaveBeenCalled();
  });
  it('keeps a tooltip in place when it already fits the map viewport', () => {
    expect(stopHelpPosition({ x: 200, y: 160 }, { width: 240, height: 80 }, { x: 0, y: 0, width: 390, height: 280 }, 8)).toEqual({ x: 200, y: 160 });
  });
  it('keeps help visible near the edges of a short, zoomed map', () => {
    const view = { x: 500, y: 300, width: 200, height: 140 };
    expect(stopHelpPosition({ x: 505, y: 280 }, { width: 120, height: 50 }, view, 4)).toEqual({ x: 564, y: 354 });
    expect(stopHelpPosition({ x: 700, y: 500 }, { width: 120, height: 50 }, view, 4)).toEqual({ x: 636, y: 436 });
  });
});
