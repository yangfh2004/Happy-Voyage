import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { bindBattleButton } from './battleButton';

const pointer = { id: 1 };
const event = () => ({ stopPropagation: vi.fn() });

describe('battle threshold buttons', () => {
  it('does not change settings when a selection drag ends over a button', () => {
    const button = new EventEmitter(), command = vi.fn();
    bindBattleButton(button, command);
    button.emit('pointerup', pointer, 0, 0, event());
    expect(command).not.toHaveBeenCalled();
  });

  it('only accepts a matching press and release on the same button', () => {
    const first = new EventEmitter(), second = new EventEmitter(), command = vi.fn();
    bindBattleButton(first, command);
    bindBattleButton(second, command);
    const down = event();
    first.emit('pointerdown', pointer, 0, 0, down);
    second.emit('pointerup', pointer, 0, 0, event());
    first.emit('pointerup', { id: 2 }, 0, 0, event());
    expect(command).not.toHaveBeenCalled();
    const up = event();
    first.emit('pointerup', pointer, 0, 0, up);
    expect(command).toHaveBeenCalledTimes(1);
    expect(down.stopPropagation).toHaveBeenCalledOnce();
    expect(up.stopPropagation).toHaveBeenCalledOnce();
    first.emit('pointerup', pointer, 0, 0, event());
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('cancels a press when the pointer leaves the button', () => {
    const button = new EventEmitter(), command = vi.fn();
    bindBattleButton(button, command);
    button.emit('pointerdown', pointer, 0, 0, event());
    button.emit('pointerout', pointer);
    button.emit('pointerup', pointer, 0, 0, event());
    expect(command).not.toHaveBeenCalled();
    button.emit('pointerdown', pointer, 0, 0, event());
    button.emit('pointerup', pointer, 0, 0, event());
    expect(command).toHaveBeenCalledTimes(1);
  });
});
