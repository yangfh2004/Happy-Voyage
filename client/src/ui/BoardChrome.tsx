import { chartIdentity, playerName, rankName, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { useT } from '../i18n';
import { NavigatorPortrait } from './NavigatorPortrait';
import { cssColor } from './nations';
import { LogPanel } from './LogPanel';

function ResourceIcon({ ship = false }: { ship?: boolean }) {
  return <svg className="resource-icon" viewBox="0 0 24 24" aria-hidden="true">{ship ? <><path d="M3 16h18l-4 5H7Z" fill="#91bfdd" /><path d="M12 2v14H5Zm2 2 6 10h-6Z" fill="#fff4d5" stroke="#947439" /></> : <><circle cx="12" cy="12" r="10" fill="#edbd45" stroke="#9c6b13" /><path d="M15 7h-5a3 3 0 0 0 0 5h4a3 3 0 0 1 0 5H8m4-13v16" fill="none" stroke="#855313" strokeWidth="2" /></>}</svg>;
}

export function canEndTurn(state: GameState, atHelm: boolean) {
  return atHelm && ['awaitingClaim', 'awaitingRecruit', 'awaitingBarter', 'awaitingMerchant'].includes(state.phase);
}

export function VoyageTopBar({ state, colorBlind, onMenu, menuOpen }: { state: GameState; colorBlind: boolean; onMenu: () => void; menuOpen: boolean }) {
  const { t, locale } = useT();
  return <header className="voyage-top">
    <div className="voyage-logo">⚓ <span>{t('HAPPY VOYAGE', '欢乐大航海')}</span></div>
    <div className="voyage-seats">
      {state.players.map((p) => {
        const { color, badge } = chartIdentity(p, colorBlind);
        return <div key={p.id} className={`voyage-chip ${p.id === state.currentPlayer ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''}`} style={{ borderColor: cssColor(color) }}>
          {p.id === state.currentPlayer && <span className="current-label">♛ {t('CURRENT TURN', '当前回合')}</span>}
          {p.navigator && <NavigatorPortrait navigator={p.navigator} color={color} size={30} />}
          <strong>{badge && `${badge} · `}{playerName(p, locale)}</strong>
          <span aria-label={t('Gold and ships', '金币与船只')}><ResourceIcon /> {gameController.displayGold(p)} · <ResourceIcon ship /> {p.fleet.length}</span>
          <small>{p.bankrupt ? t('Bankrupt', '破产') : p.isAI ? t('AI', '电脑') : t('Player', '玩家')}</small>
        </div>;
      })}
    </div>
    <div className="voyage-menu-control"><span>{t('Turn: {p}', '回合：{p}', { p: playerName(state.players[state.currentPlayer], locale) })}</span><button aria-expanded={menuOpen} aria-controls="voyage-menu" onClick={onMenu}>⚙ {t('Menu', '菜单')}</button></div>
  </header>;
}

export function HelmCard({ state, colorBlind, atHelm }: { state: GameState; colorBlind: boolean; atHelm: boolean }) {
  const { t, locale } = useT();
  const p = state.players[state.currentPlayer];
  const { color } = chartIdentity(p, colorBlind);
  return <section className="helm-card">
    <h2>☸ {atHelm ? t('YOUR TURN', '你的回合') : t('AT THE HELM', '掌舵中')}</h2>
    {p.navigator && <div className="helm-portrait"><NavigatorPortrait navigator={p.navigator} color={color} size={88} /></div>}
    <h2>{playerName(p, locale)}</h2>
    <dl><div><dt><ResourceIcon /> {t('Gold', '金币')}</dt><dd>{gameController.displayGold(p)}</dd></div><div><dt><ResourceIcon ship /> {t('Ships', '船只')}</dt><dd>{p.fleet.length}</dd></div><div><dt>♛ {t('Rank', '爵位')}</dt><dd>{rankName(p.rank, locale)}</dd></div></dl>
  </section>;
}

export function VoyageBottomBar({ state, atHelm }: { state: GameState; atHelm: boolean }) {
  const { t } = useT();
  return <footer className="voyage-bottom"><strong>📜 {t('EVENT LOG', '航海日志')}</strong><LogPanel state={state} log={gameController.visibleLogText(state)} tones={gameController.feedback.logTones} limit={3} /><button disabled={!canEndTurn(state, atHelm)} onClick={() => gameController.decline()}>{t('End Turn', '结束回合')} ↪</button></footer>;
}
