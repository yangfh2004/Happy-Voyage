import { localize, playerName as localPlayerName, ref, seaEventTx, type EventKind } from '@happy-voyage/shared';
import { gameController, type SeaNotice } from '../game/GameController';
import { useT } from '../i18n';

export const SEA_ICONS: Record<EventKind, string> = {
  treasure: '◆', storm: 'ϟ', tradeWind: '≈', pirates: '⚔', smallMonster: '♆',
  largeMonster: 'M', turtle: 'T', whirlpool: '◎', bottle: '✉', floatingCargo: '▣', merchant: '¤', wyvern: 'W',
};

export function SeaNotifications({ notices, onDismiss }: { notices: SeaNotice[]; onDismiss: (id: number) => void }) {
  const { t, locale } = useT();
  const state = gameController.state;
  return <section className="sea-notifications" aria-label={t('Sea encounters', '海上遭遇')} aria-live="polite" aria-relevant="additions">
    {notices.map(({ id, event, playerName, playerId, destination, destinationId }) => {
      const player = playerId === undefined ? undefined : state?.players[playerId];
      const name = player ? localPlayerName(player, locale) : playerName;
      const where = destinationId !== undefined && state ? ref.node(destinationId) : destination;
      return <div key={id} className={`sea-notice sea-${event.event}`} role="status">
      <span className="sea-icon" aria-hidden="true">{SEA_ICONS[event.event]}</span>
      <div><strong>{name}</strong><p>{localize(locale, seaEventTx(event, where), state)}</p></div>
      <button aria-label={t('Dismiss {p} sea encounter', '关闭 {p} 的海上遭遇', { p: name })} onClick={() => onDismiss(id)}>×</button>
    </div>;
    })}
  </section>;
}
