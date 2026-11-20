import { seaEventText, type EventKind } from '@happy-voyage/shared';
import type { SeaNotice } from '../game/GameController';

export const SEA_ICONS: Record<EventKind, string> = {
  treasure: '◆', storm: 'ϟ', tradeWind: '≈', pirates: '⚔', smallMonster: '♆',
  largeMonster: 'M', turtle: 'T', whirlpool: '◎', bottle: '✉', floatingCargo: '▣', merchant: '¤', wyvern: 'W',
};

export function SeaNotifications({ notices, onDismiss }: { notices: SeaNotice[]; onDismiss: (id: number) => void }) {
  return <section className="sea-notifications" aria-label="Sea encounters" aria-live="polite" aria-relevant="additions">
    {notices.map(({ id, event, playerName, destination }) => <div key={id} className={`sea-notice sea-${event.event}`} role="status">
      <span className="sea-icon" aria-hidden="true">{SEA_ICONS[event.event]}</span>
      <div><strong>{playerName}</strong><p>{seaEventText(event, destination)}</p></div>
      <button aria-label={`Dismiss ${playerName} sea encounter`} onClick={() => onDismiss(id)}>×</button>
    </div>)}
  </section>;
}
