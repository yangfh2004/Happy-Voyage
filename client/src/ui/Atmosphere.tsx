import { atmosphere, type GameState } from '@happy-voyage/shared';

export function Atmosphere({ state }: { state: GameState | null }) {
  const { phase, weather } = atmosphere(state);
  return <>
    <div className={`atmosphere atmosphere-${phase} weather-${weather}`} aria-hidden="true">
      {Array.from({ length: 32 }, (_, i) => <i key={i} style={{ left: `${(i * 37 + 7) % 100}%`, top: `${(i * 23 + 11) % 100}%`, animationDelay: `${-i * 0.37}s` }} />)}
      <div className="weather-cloud cloud-one" /><div className="weather-cloud cloud-two" />
    </div>
    {state && <div className="atmosphere-status" role="status">{({ dawn: '☀ Dawn', day: '☀ Day', dusk: '◒ Dusk', night: '☾ Night' })[phase]} · {weather}</div>}
  </>;
}
