import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SOUND, listenForSoundtrackStart, parseSoundSettings, sfx, startSoundtrack } from './sfx';
import { SHANTY } from './shanty';

describe('sound settings', () => {
  it('defaults when nothing is stored and honours the legacy mute flag', () => {
    expect(parseSoundSettings(null)).toEqual(DEFAULT_SOUND);
    expect(parseSoundSettings(null, '1')).toEqual({ ...DEFAULT_SOUND, muted: true });
  });

  it('clamps volumes and ignores corrupt values', () => {
    expect(parseSoundSettings(JSON.stringify({ muted: false, music: 2, waves: -1, effects: 'loud' }), '1'))
      .toEqual({ muted: false, music: 1, waves: 0, effects: DEFAULT_SOUND.effects });
    expect(parseSoundSettings('{not json')).toEqual(DEFAULT_SOUND);
  });

  it('stays silent without Web Audio', () => {
    expect(() => {
      startSoundtrack();
      sfx.battle(3, 2, 'victory');
      sfx.sell();
      sfx.buy();
      sfx.barter();
    }).not.toThrow();
  });
});

describe('soundtrack startup', () => {
  afterEach(() => vi.unstubAllGlobals());

  function listen() {
    const target = new EventTarget();
    const userActivation = { isActive: false };
    vi.stubGlobal('navigator', { userActivation });
    const start = vi.fn();
    const stop = listenForSoundtrackStart(target, start);
    const input = (type: string, pointerType?: string) =>
      target.dispatchEvent(Object.assign(new Event(type), { pointerType }));
    return { userActivation, start, stop, input };
  }

  it.each(['touch', 'pen'])('starts on the release of the first %s press', (pointerType) => {
    const { userActivation, start, input } = listen();
    userActivation.isActive = true;
    input('pointerdown', pointerType);
    expect(start).not.toHaveBeenCalled();
    input('pointerup', pointerType);
    expect(start).toHaveBeenCalledOnce();
  });

  it('ignores input without activation and retries on later mouse and keyboard gestures until unmounted', () => {
    const { userActivation, start, stop, input } = listen();
    input('keydown');
    expect(start).not.toHaveBeenCalled();
    userActivation.isActive = true;
    input('pointerdown', 'mouse');
    input('pointerup', 'mouse');
    expect(start).toHaveBeenCalledOnce();
    input('keydown');
    expect(start).toHaveBeenCalledTimes(2);
    stop();
    input('pointerdown', 'mouse');
    input('pointerup', 'touch');
    input('keydown');
    expect(start).toHaveBeenCalledTimes(2);
  });
});

describe('shanty', () => {
  it('fills every 6/8 bar exactly', () => {
    expect(SHANTY).toHaveLength(16);
    for (const bar of SHANTY) expect(bar.melody.reduce((sum, [, eighths]) => sum + eighths, 0)).toBe(6);
  });
});
