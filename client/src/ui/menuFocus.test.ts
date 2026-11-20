import { describe, expect, it } from 'vitest';
import { menuTabTarget } from './menuFocus';

describe('voyage menu keyboard focus', () => {
  it('wraps forward and backward at the modal boundaries', () => {
    expect(menuTabTarget(['close', 'speed', 'route'], 'route', false)).toBe('close');
    expect(menuTabTarget(['close', 'speed', 'route'], 'close', true)).toBe('route');
    expect(menuTabTarget(['close', 'speed', 'route'], 'speed', false)).toBeNull();
  });
  it('recovers focus from outside and handles empty and single-control menus', () => {
    expect(menuTabTarget(['close'], 'outside', false)).toBe('close');
    expect(menuTabTarget(['close'], 'close', true)).toBe('close');
    expect(menuTabTarget([], null, false)).toBeNull();
  });
});
