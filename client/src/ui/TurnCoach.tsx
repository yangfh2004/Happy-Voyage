import { useEffect, useState } from 'react';
import type { GameState } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { readPreference, writePreference } from './accessibilityPreferences';
import { gameController } from '../game/GameController';

export function coachStage(phase: GameState['phase'], atHelm: boolean, dismissed: boolean, hasTarget: boolean) {
  if (!atHelm || dismissed) return null;
  if (phase === 'awaitingSpin') return 'spin';
  return hasTarget && (phase === 'spinning' || phase === 'moving') ? 'landing' : null;
}

export function TurnCoach({ state, atHelm, target }: { state: GameState; atHelm: boolean; target: { x: number; y: number } | null }) {
  const { t } = useT();
  const [dismissed, setDismissed] = useState(() => readPreference('coach-dismissed'));
  const [started, setStarted] = useState(false);
  const [button, setButton] = useState<{ x: number; y: number } | null>(null);
  const traveling = state.phase === 'spinning' || state.phase === 'moving';
  const dismiss = () => { writePreference('coach-dismissed', true); setDismissed(true); };
  useEffect(() => {
    if (atHelm && state.phase === 'awaitingSpin') setStarted(true);
    if (started && !traveling && state.phase !== 'awaitingSpin') dismiss();
  }, [atHelm, state.phase, started, traveling]);
  useEffect(() => {
    const update = () => {
      const rect = document.querySelector('.turn-action-panel .primary.big')?.getBoundingClientRect();
      setButton(rect ? { x: rect.left + rect.width / 2, y: rect.top } : null);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [state.phase]);
  const stage = coachStage(state.phase, atHelm, dismissed, !!gameController.landingTarget);
  const point = stage === 'landing' ? target : stage === 'spin' ? button : null;
  if (!point) return null;
  return <aside className="turn-coach" role="status" style={{ left: Math.max(100, Math.min(window.innerWidth - 100, point.x)), top: Math.max(52, point.y - (traveling ? 110 : 66)) }}>
    <span>{traveling ? t("You'll land here", '你将在这里靠岸') : t('Spin to sail', '转动罗盘启航')} ↓</span>
    <button aria-label={t('Dismiss tip', '关闭提示')} onClick={dismiss}>✕</button>
  </aside>;
}
