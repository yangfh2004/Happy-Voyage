import type { GameState } from './types';
import { marketDemand } from './market';

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
export type VisualWeather = 'clear' | 'clouds' | 'rain' | 'fog' | 'storm';

export function atmosphere(state: Pick<GameState, 'round' | 'market'> | null): { phase: DayPhase; weather: VisualWeather } {
  if (!state) return { phase: 'day', weather: 'clear' };
  const round = Number.isFinite(state.round) ? Math.max(1, Math.floor(state.round)) : 1;
  const phase = (['dawn', 'day', 'dusk', 'night'] as const)[(round - 1) % 4];
  const storm = marketDemand({ ...state, round } as GameState).stormRepairs;
  const weather = storm ? 'storm' : (['clear', 'clouds', 'rain', 'clear', 'fog'] as const)[(round - 1) % 5];
  return { phase, weather };
}
