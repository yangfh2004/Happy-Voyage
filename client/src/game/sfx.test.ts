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
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

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

  it('starts on the release of the first pen press', () => {
    const { userActivation, start, input } = listen();
    userActivation.isActive = true;
    input('pointerdown', 'pen');
    expect(start).not.toHaveBeenCalled();
    input('pointerup', 'pen');
    expect(start).toHaveBeenCalledOnce();
  });

  it('tries touchend and click even if WebKit does not report user activation', () => {
    const { userActivation, start, input } = listen();
    userActivation.isActive = true;
    input('pointerdown', 'touch');
    input('pointerup', 'touch');
    expect(start).not.toHaveBeenCalled();
    userActivation.isActive = false;
    input('touchend');
    expect(start).toHaveBeenCalledOnce();
    input('click');
    expect(start).toHaveBeenCalledTimes(2);
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
    input('touchend');
    input('click');
    input('keydown');
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('primes the shared context synchronously and retries an interruption without overriding game mute', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const session = { type: 'auto' };
    vi.stubGlobal('navigator', { audioSession: session, userActivation: { isActive: false } });
    const target = new EventTarget();
    const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} };
    const node = { connect: () => node, disconnect() {}, gain: param, frequency: param, playbackRate: param, detune: param, start() {}, stop() {} };
    const priming = vi.fn();
    const resume = vi.fn().mockRejectedValueOnce(new Error('interrupted')).mockResolvedValue(undefined);
    const ctx = {
      state: 'suspended',
      sampleRate: 8000,
      currentTime: 0,
      destination: node,
      createGain: () => node,
      createDynamicsCompressor: () => node,
      createBiquadFilter: () => node,
      createOscillator: () => node,
      createBuffer: (_channels: number, length: number) => ({ length, getChannelData: () => new Float32Array(length) }),
      createBufferSource: () => ({
        ...node,
        buffer: { length: 0 },
        start() { if (this.buffer.length === 1) priming(session.type); },
      }),
      resume,
    };
    vi.stubGlobal('AudioContext', function () { return ctx; });
    const audio = await import('./sfx');
    const stop = audio.listenForSoundtrackStart(target, audio.startSoundtrack);
    audio.resumeSoundtrack();
    expect(resume).not.toHaveBeenCalled();
    target.dispatchEvent(new Event('touchend'));
    expect(resume).toHaveBeenCalledOnce();
    expect(priming).toHaveBeenCalledOnce();
    expect(priming).toHaveBeenCalledWith('playback');
    ctx.state = 'interrupted';
    audio.resumeSoundtrack();
    expect(resume).toHaveBeenCalledTimes(2);
    target.dispatchEvent(new Event('click'));
    expect(resume).toHaveBeenCalledTimes(3);
    expect(priming).toHaveBeenCalledTimes(2);
    ctx.state = 'running';
    target.dispatchEvent(new Event('click'));
    expect(priming).toHaveBeenCalledTimes(2);
    audio.setMuted(true);
    ctx.state = 'interrupted';
    audio.resumeSoundtrack();
    target.dispatchEvent(new Event('touchend'));
    expect(resume).toHaveBeenCalledTimes(3);
    expect(priming).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe('shanty', () => {
  it('fills every 6/8 bar exactly', () => {
    expect(SHANTY).toHaveLength(16);
    for (const bar of SHANTY) expect(bar.melody.reduce((sum, [, eighths]) => sum + eighths, 0)).toBe(6);
  });
});
