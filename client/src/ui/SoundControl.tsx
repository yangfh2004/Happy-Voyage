import { useT } from '../i18n';

const SOUND_ZH: Record<string, string> = { music: '音乐', waves: '海浪', effects: '音效' };
import { gameController } from '../game/GameController';
import { SOUND_CHANNELS, soundSettings } from '../game/sfx';

/** Mute switch plus music, waves and effects volume sliders. */
export function SoundControl() {
  const { t } = useT();
  const sound = soundSettings();
  return (
    <div className={sound.muted ? 'sound-control muted' : 'sound-control'} role="group" aria-label={t('Sound', '声音')}>
      <button className="sound" onClick={() => gameController.toggleMute()} aria-pressed={!sound.muted}>
        {sound.muted ? t('Sound off', '声音关') : t('Sound on', '声音开')} <kbd>M</kbd>
      </button>
      {SOUND_CHANNELS.map(({ id, label }) => (
        <label key={id}>
          {t(label, SOUND_ZH[id] ?? label)}
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(sound[id] * 100)}
            aria-label={t('{c} volume', '{c}音量', { c: t(label, SOUND_ZH[id] ?? label) })}
            onChange={(e) => gameController.setVolume(id, Number(e.target.value) / 100)}
          />
        </label>
      ))}
    </div>
  );
}
