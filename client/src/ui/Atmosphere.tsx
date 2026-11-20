import { atmosphere, type GameState } from '@happy-voyage/shared';
import { useT } from '../i18n';

export function Atmosphere({ state }: { state: GameState | null }) {
  const { t } = useT();
  const { phase, weather } = atmosphere(state);
  const phaseLabel = { dawn: t('☀ Dawn', '☀ 黎明'), day: t('☀ Day', '☀ 白天'), dusk: t('◒ Dusk', '◒ 黄昏'), night: t('☾ Night', '☾ 夜晚') }[phase];
  const weatherLabel = { clear: t('Clear', '晴朗'), clouds: t('Clouds', '多云'), rain: t('Rain', '降雨'), fog: t('Fog', '雾'), storm: t('Storm', '风暴') }[weather];
  const direction = state?.wind.direction ?? 'N';
  const windLabel = { N: t('North wind', '北风'), E: t('East wind', '东风'), S: t('South wind', '南风'), W: t('West wind', '西风') }[direction];
  const arrow = { N: '↑', E: '→', S: '↓', W: '←' }[direction];
  return state && <div className="atmosphere-status" role="status">{phaseLabel} · {weatherLabel} · {arrow} {windLabel} · {t('Changes in {n} turns', '{n} 个回合后转向', { n: state.wind.turnsLeft })}</div>;
}
