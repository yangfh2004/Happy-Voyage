import { afterEach, describe, expect, it, vi } from 'vitest';
import { menuTabTarget, trapMenuFocus } from './menuFocus';

afterEach(() => vi.unstubAllGlobals());

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
  it('removes document listeners and restores the opener when disposed after unmount', () => {
    const listeners = new Map<string, EventListener>();
    let active: Control;
    class Control {
      isConnected = true;
      tabIndex = 0;
      focus() { active = this; }
      getClientRects() { return [{}]; }
      closest(_selector: string): object | null { return null; }
    }
    const opener = new Control();
    const close = new Control();
    const collapsed = Object.assign(new Control(), { closest: () => ({}) });
    const menu = Object.assign(new Control(), {
      querySelectorAll: () => [close, collapsed],
      contains: (node: Control) => node === close,
    });
    active = opener;
    vi.stubGlobal('HTMLElement', Control);
    vi.stubGlobal('document', {
      get activeElement() { return active; },
      addEventListener: (name: string, listener: EventListener) => listeners.set(name, listener),
      removeEventListener: (name: string) => listeners.delete(name),
    });
    const dispose = trapMenuFocus(menu as unknown as HTMLElement, vi.fn());
    expect(active).toBe(close);
    expect([...listeners.keys()]).toEqual(['keydown', 'focusin']);
    listeners.get('keydown')!({ key: 'Tab', shiftKey: true, preventDefault: vi.fn() } as unknown as Event);
    expect(active).toBe(close);
    menu.isConnected = false;
    dispose();
    expect(listeners.size).toBe(0);
    expect(active).toBe(opener);
  });
});
