import type { GameState, Text } from '@happy-voyage/shared';
import { useT } from '../i18n';
import './TurnIndicator.css';

export function TurnIndicator({ state, notice, action }: { state: GameState; notice: Text | null; action: Text | null }) {
  const { l } = useT();
  if (state.phase === 'gameOver' || (!notice && !action)) return null;
  return <div className="turn-indicator" role="status" aria-live="polite">
    {notice && <strong>{l(notice, state)}</strong>}
    {action && <span>{l(action, state)}</span>}
  </div>;
}
