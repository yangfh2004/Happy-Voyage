import { gameController } from '../game/GameController';
import { SOUND_CHANNELS, soundSettings } from '../game/sfx';

/** Mute switch plus music, waves and effects volume sliders. */
export function SoundControl() {
  const sound = soundSettings();
  return (
    <div className={sound.muted ? 'sound-control muted' : 'sound-control'} role="group" aria-label="Sound">
      <button className="sound" onClick={() => gameController.toggleMute()} aria-pressed={!sound.muted}>
        {sound.muted ? 'Sound off' : 'Sound on'} <kbd>M</kbd>
      </button>
      {SOUND_CHANNELS.map(({ id, label }) => (
        <label key={id}>
          {label}
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(sound[id] * 100)}
            aria-label={`${label} volume`}
            onChange={(e) => gameController.setVolume(id, Number(e.target.value) / 100)}
          />
        </label>
      ))}
    </div>
  );
}
