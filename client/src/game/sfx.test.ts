import { describe, expect, it } from 'vitest';
import { DEFAULT_SOUND, parseSoundSettings, sfx, startSoundtrack } from './sfx';
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

describe('shanty', () => {
  it('fills every 6/8 bar exactly', () => {
    expect(SHANTY).toHaveLength(16);
    for (const bar of SHANTY) expect(bar.melody.reduce((sum, [, eighths]) => sum + eighths, 0)).toBe(6);
  });
});
