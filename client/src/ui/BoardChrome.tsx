import { chartIdentity, nodeName, playerName, rankName, tollDue, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { useT } from '../i18n';
import { NavigatorPortrait } from './NavigatorPortrait';
import { cssColor } from './nations';
import { LogPanel } from './LogPanel';
import { SoundControl } from './SoundControl';

function ResourceIcon({ ship = false }: { ship?: boolean }) {
  return <svg className="resource-icon" viewBox="0 0 24 24" aria-hidden="true">{ship ? <><path d="M3 16h18l-4 5H7Z" fill="#91bfdd" /><path d="M12 2v14H5Zm2 2 6 10h-6Z" fill="#fff4d5" stroke="#947439" /></> : <><circle cx="12" cy="12" r="10" fill="#edbd45" stroke="#9c6b13" /><path d="M15 7h-5a3 3 0 0 0 0 5h4a3 3 0 0 1 0 5H8m4-13v16" fill="none" stroke="#855313" strokeWidth="2" /></>}</svg>;
}

export function endTurnAction(state: GameState, atHelm: boolean, lotteryRevealed = true) {
  if (!atHelm) return null;
  switch (state.phase) {
    case 'awaitingClaim': return 'decline';
    case 'awaitingRecruit': return 'declineRecruit';
    case 'awaitingBarter': return 'declineBarter';
    case 'awaitingMerchant': return state.pendingMerchant ? 'declineMerchant' : null;
    case 'awaitingBuild': return 'finishBuilding';
    case 'awaitingMarket': return 'finishMarket';
    case 'awaitingCargoMarket': return 'finishTrading';
    case 'awaitingLottery': return state.lottery?.draw && lotteryRevealed ? 'finishLottery' : null;
    case 'awaitingMistDuel': return state.mistDuel && (state.mistDuel.hermitId === null || state.mistDuel.result !== null) ? 'leaveMistIsland' : null;
    case 'awaitingToll': {
      const player = state.players[state.currentPlayer];
      return state.owners[player.position] != null && tollDue(state, player, player.position) === 0 ? 'payToll' : null;
    }
    default: return null;
  }
}

export function canEndTurn(state: GameState, atHelm: boolean, lotteryRevealed = true) {
  return endTurnAction(state, atHelm, lotteryRevealed) !== null;
}

export function VoyageTopBar({ state, colorBlind, onMenu, menuOpen }: { state: GameState; colorBlind: boolean; onMenu: () => void; menuOpen: boolean }) {
  const { t, locale } = useT();
  return <header className="voyage-top">
    <div className="voyage-logo">⚓ <span>{t('HAPPY VOYAGE', '欢乐大航海')}</span></div>
    <div className="mobile-sound"><SoundControl /></div>
    <div className="voyage-seats">
      {state.players.map((p) => {
        const { color, badge } = chartIdentity(p, colorBlind);
        return <div key={p.id} className={`voyage-chip ${p.id === state.currentPlayer ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''}`} style={{ borderColor: cssColor(color) }}>
          {p.id === state.currentPlayer && <span className="current-label">♛ {t('CURRENT TURN', '当前回合')}</span>}
          {p.navigator && <NavigatorPortrait navigator={p.navigator} color={color} size={30} />}
          <strong>{!badge && <span className="seat-number">{p.id + 1} </span>}{badge && `${badge} · `}{playerName(p, locale)}</strong>
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
  const action = endTurnAction(state, atHelm, gameController.lotteryRevealed);
  return <footer className="voyage-bottom"><strong>📜 {t('EVENT LOG', '航海日志')}</strong><LogPanel state={state} log={gameController.visibleLogText(state)} tones={gameController.feedback.logTones} limit={3} /><button disabled={!action} onClick={() => { if (action) gameController[action](); }}>{t('End Turn', '结束回合')} ↪</button></footer>;
}

export function NextStop({ state }: { state: GameState }) {
  const { t, locale } = useT();
  const target = gameController.landingTarget;
  if (!target) return null;
  const node = state.map.find((stop) => stop.id === target.nodeId);
  if (!node) return null;
  return <div className="next-stop" role="status"><span aria-hidden="true">⚓</span><div><small>{t('NEXT STOP', '下一站')}</small><strong>{nodeName(node, locale)}</strong><span>{t('{n} steps', '{n} 步', { n: target.steps ?? 0 })}</span></div></div>;
}

export function LandingHeading({ state }: { state: GameState }) {
  const { t, locale } = useT();
  const player = state.players[state.currentPlayer];
  const node = state.map[state.pendingClaim ?? player.position];
  const ownerId = state.owners[node.id];
  const owner = ownerId == null ? state.players.find((p) => p.homePort === node.id) : state.players[ownerId];
  return <header className="landing-heading"><div><small>⚓ {t('LANDFALL', '抵达')}</small><h2>{nodeName(node, locale)}</h2></div><div><strong>{owner ? t('Owned by {p}', '属于 {p}', { p: playerName(owner, locale) }) : t('Unowned', '无主之地')}</strong><p>{t('Treasury: {g}g', '金库：{g} 金币', { g: gameController.displayGold(player) })}{node.price != null && state.phase === 'awaitingClaim' && t(' · Cost: {g}g', ' · 费用：{g} 金币', { g: node.price })}</p></div></header>;
}
