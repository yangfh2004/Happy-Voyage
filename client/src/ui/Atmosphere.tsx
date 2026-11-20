import { atmosphere, type GameState } from '@happy-voyage/shared';

export function Atmosphere({ state }: { state: GameState | null }) {
  const { phase, weather } = atmosphere(state);
  return state && <div className="atmosphere-status" role="status">{({ dawn: '☀ Dawn', day: '☀ Day', dusk: '◒ Dusk', night: '☾ Night' })[phase]} · {weather}</div>;
}
