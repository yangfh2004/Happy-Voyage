import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameController } from './GameController';
import { keyboardShortcuts } from './keyboard';

const controller = {
  state: { phase: 'awaitingSpin' } as { phase: string } | null,
  spinCompass: vi.fn(), claim: vi.fn(), decline: vi.fn(), quit: vi.fn(),
  finishBuilding: vi.fn(), finishTrading: vi.fn(),
  skipToMyTurn: vi.fn(), setSpeed: vi.fn(), confirmHandoff: vi.fn(),
  awaitingHandoff: false,
};
let keys: ReturnType<typeof keyboardShortcuts>;
function event(key: string, extra = {}) {
  return { key, preventDefault: vi.fn(), ...extra } as unknown as KeyboardEvent;
}
beforeEach(() => {
  vi.clearAllMocks();
  controller.state = { phase: 'awaitingSpin' };
  controller.awaitingHandoff = false;
  keys = keyboardShortcuts(controller as unknown as GameController);
});

describe('keyboard shortcuts', () => {
  it('routes keys and suppresses browser defaults', () => {
    for (const key of [' ', 'Enter', 'C', 's', 'Escape', 'k', '1', '2', '3']) {
      const press = event(key);
      keys.keydown(press);
      expect(press.preventDefault).toHaveBeenCalledOnce();
      keys.keyup(press);
    }
    expect(controller.spinCompass).toHaveBeenCalledTimes(2);
    expect(controller.claim).toHaveBeenCalledOnce();
    expect(controller.decline).toHaveBeenCalledTimes(2);
    expect(controller.skipToMyTurn).toHaveBeenCalledOnce();
    expect(controller.setSpeed.mock.calls).toEqual([['Normal'], ['Fast'], ['Instant']]);
  });

  it('requires release before firing again and prevents default even on repeat', () => {
    keys.keydown(event(' '));
    const repeat = event(' ', { repeat: true });
    keys.keydown(repeat);
    keys.keydown(event(' '));
    expect(repeat.preventDefault).toHaveBeenCalledOnce();
    expect(controller.spinCompass).toHaveBeenCalledOnce();
    expect(controller.claim).not.toHaveBeenCalled();
    keys.keyup(event(' '));
    keys.keydown(event(' '));
    expect(controller.spinCompass).toHaveBeenCalledTimes(2);
    keys.blur();
    keys.keydown(event(' '));
    expect(controller.spinCompass).toHaveBeenCalledTimes(3);
  });

  it('uses Enter and Space to quit only at game over', () => {
    controller.state = { phase: 'gameOver' };
    keys.keydown(event('Enter'));
    keys.keydown(event(' '));
    expect(controller.quit).toHaveBeenCalledTimes(2);
    expect(controller.spinCompass).not.toHaveBeenCalled();
  });

  it.each(['d', 'Escape'])('ends a market visit with %s', (key) => {
    controller.state = { phase: 'awaitingCargoMarket' };
    keys.keydown(event(key));
    expect(controller.finishTrading).toHaveBeenCalledOnce();
    expect(controller.finishBuilding).not.toHaveBeenCalled();
    expect(controller.decline).not.toHaveBeenCalled();
  });

  it('ignores editing, composition, modifier shortcuts and unrelated keys', () => {
    for (const extra of [{ target: { closest: () => ({}) } }, { isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      const press = event('c', extra);
      keys.keydown(press);
      expect(press.preventDefault).not.toHaveBeenCalled();
    }
    const unknown = event('z');
    keys.keydown(unknown);
    expect(unknown.preventDefault).not.toHaveBeenCalled();
    expect(controller.claim).not.toHaveBeenCalled();
  });

  it('allows native setup button activation but handles setup speed keys', () => {
    controller.state = null;
    const enter = event('Enter');
    keys.keydown(enter);
    expect(enter.preventDefault).not.toHaveBeenCalled();
    keys.keydown(event('3'));
    expect(controller.setSpeed).toHaveBeenCalledWith('Instant');
  });

  it('leaves Enter and Space native on focused controls, including nested hints', () => {
    const target = { closest: (selector: string) => selector.startsWith('button,') ? {} : null };
    for (const phase of ['awaitingSpin', 'gameOver']) {
      controller.state = { phase };
      for (const key of ['Enter', ' ']) {
        const press = event(key, { target });
        keys.keydown(press);
        expect(press.preventDefault).not.toHaveBeenCalled();
      }
    }
    expect(controller.spinCompass).not.toHaveBeenCalled();
    expect(controller.quit).not.toHaveBeenCalled();
    keys.keydown(event('2', { target }));
    keys.keydown(event('c', { target }));
    expect(controller.setSpeed).toHaveBeenCalledWith('Fast');
    expect(controller.claim).toHaveBeenCalledOnce();
  });

  it('confirms a hot-seat handoff before the next spin', () => {
    controller.awaitingHandoff = true;
    keys.keydown(event(' '));
    expect(controller.confirmHandoff).toHaveBeenCalledOnce();
    expect(controller.spinCompass).not.toHaveBeenCalled();
  });
});
