import type { ReactElement } from 'react';
import { chartIdentity, isEliminated, nodeName, playerName, rankName, tollDue, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { useT } from '../i18n';
import { NavigatorPortrait } from './NavigatorPortrait';
import { cssColor } from './nations';
import { fleetDurabilitySummary } from './fleetSummary';
import { LogPanel, VoyageLogButton } from './LogPanel';
import { SoundControl } from './SoundControl';

type Resource = 'gold' | 'ship' | 'colony' | 'card';

const RESOURCE_ART: Record<Resource, ReactElement> = {
  gold: <><circle cx="12" cy="12" r="10" fill="#edbd45" stroke="#9c6b13" /><path d="M15 7h-5a3 3 0 0 0 0 5h4a3 3 0 0 1 0 5H8m4-13v16" fill="none" stroke="#855313" strokeWidth="2" /></>,
  ship: <><path d="M3 16h18l-4 5H7Z" fill="#91bfdd" /><path d="M12 2v14H5Zm2 2 6 10h-6Z" fill="#fff4d5" stroke="#947439" /></>,
  colony: <><path d="M2 21c3-4 17-4 20 0Z" fill="#7fb36a" stroke="#3f6b33" /><path d="M8 19V3" stroke="#e8d7a8" strokeWidth="2" /><path d="M9 3h10l-3 3.5L19 10H9Z" fill="#e0574a" stroke="#8c2c23" /></>,
  card: <><rect x="7" y="3" width="13" height="17" rx="2" fill="#c9a55a" stroke="#7a5a1d" transform="rotate(10 13 11)" /><rect x="4" y="4" width="13" height="17" rx="2" fill="#fff4d5" stroke="#947439" /><path d="m10.5 8 1.4 3 3 .3-2.3 2 .7 3-2.8-1.6-2.8 1.6.7-3-2.3-2 3-.3Z" fill="#2f6ea3" /></>,
};

function ResourceIcon({ kind = 'gold' }: { kind?: Resource }) {
  return <svg className="resource-icon" viewBox="0 0 24 24" aria-hidden="true">{RESOURCE_ART[kind]}</svg>;
}

const SrLabel = ({ text }: { text: string }) => <span className="visually-hidden">{text}</span>;

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
    case 'awaitingRevival': return 'leaveRevivalIsland';
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

export function VoyageTopBar({ state, colorBlind, onMenu, menuOpen, onFleet }: {
  state: GameState;
  colorBlind: boolean;
  onMenu: () => void;
  menuOpen: boolean;
  onFleet?: (playerId?: number) => void;
}) {
  const { t, locale } = useT();
  const viewer = state.players.find((player) => player.id === gameController.viewerId)
    ?? state.players.find((player) => !player.isAI)
    ?? state.players[state.currentPlayer];
  const viewerHull = fleetDurabilitySummary(viewer.fleet);
  return <header className="voyage-top">
    <div className="voyage-logo">⚓ <span>{t('HAPPY VOYAGE', '欢乐大航海')}</span></div>
    <div className="mobile-sound"><SoundControl /></div>
    <div className="voyage-seats">
      {state.players.map((p) => {
        const { color, badge } = chartIdentity(p, colorBlind);
        return <div key={p.id} className={`voyage-chip ${p.id === state.currentPlayer ? 'active' : ''} ${isEliminated(p) ? 'bankrupt' : ''}`} style={{ borderColor: cssColor(color) }}>
          {p.id === state.currentPlayer && <span className="current-label">♛ {t('CURRENT TURN', '当前回合')}</span>}
          {p.navigator && <NavigatorPortrait navigator={p.navigator} color={color} size={30} />}
          <strong>{!badge && <span className="seat-number">{p.id + 1} </span>}{badge && `${badge} · `}{playerName(p, locale)}</strong>
          <span><ResourceIcon /><SrLabel text={t('Gold', '金币')} /> {gameController.displayGold(p)} · <ResourceIcon kind="ship" /><SrLabel text={t('Ships', '船只')} /> {p.fleet.length}</span>
          <span><ResourceIcon kind="colony" /><SrLabel text={t('Colonies', '殖民地')} /> {gameController.islandsOwnedBy(p.id)} · <ResourceIcon kind="card" /><SrLabel text={t('Strategy cards', '谋略卡')} /> {p.strategies.length}</span>
          <small>{p.fleetLost ? t('Fleet lost', '舰队覆没') : p.bankrupt ? t('Bankrupt', '破产') : p.isAI ? t('AI', '电脑') : t('Player', '玩家')}</small>
        </div>;
      })}
    </div>
    <div className="voyage-menu-control">
      <span>{t('Turn: {p}', '回合：{p}', { p: playerName(state.players[state.currentPlayer], locale) })}</span>
      <div className="voyage-top-actions">
        {onFleet && (
          <button
            type="button"
            className={`voyage-fleet-btn ${viewerHull.damaged > 0 ? 'has-damage' : ''}`}
            onClick={() => onFleet(viewer.id)}
            aria-label={t('Fleet status ({n} ships, {pct}% durability)', '舰队状态（{n} 艘船，耐久 {pct}%）', { n: viewer.fleet.length, pct: viewerHull.percent })}
          >
            <ResourceIcon kind="ship" />
            <span>{t('Fleet', '舰队')}</span>
            {viewer.fleet.length > 0 && <small className="fleet-hull-pill">{viewerHull.percent}%</small>}
          </button>
        )}
        <button type="button" className="voyage-menu-btn" aria-expanded={menuOpen} aria-controls="voyage-menu" onClick={onMenu}>⚙ {t('Menu', '菜单')}</button>
      </div>
    </div>
  </header>;
}

export function HelmCard({ state, colorBlind, atHelm, onFleet }: {
  state: GameState;
  colorBlind: boolean;
  atHelm: boolean;
  onFleet?: (playerId?: number) => void;
}) {
  const { t, locale } = useT();
  const p = state.players[state.currentPlayer];
  const { color } = chartIdentity(p, colorBlind);
  const hull = fleetDurabilitySummary(p.fleet);
  return <section className="helm-card">
    <h2>☸ {atHelm ? t('YOUR TURN', '你的回合') : t('AT THE HELM', '掌舵中')}</h2>
    {p.navigator && <div className="helm-portrait"><NavigatorPortrait navigator={p.navigator} color={color} size={88} /></div>}
    <h2>{playerName(p, locale)}</h2>
    <dl><div><dt><ResourceIcon /> {t('Gold', '金币')}</dt><dd>{gameController.displayGold(p)}</dd></div><div><dt><ResourceIcon kind="ship" /> {t('Ships', '船只')}</dt><dd>{p.fleet.length}</dd></div><div><dt>{t('Rank', '军衔')}</dt><dd>{rankName(p.rank, locale)}</dd></div></dl>
    {onFleet && (
      <button type="button" className={`helm-fleet-btn ${hull.damaged > 0 ? 'has-damage' : ''}`} onClick={() => onFleet(p.id)}>
        <ResourceIcon kind="ship" /> {t('Fleet status', '查看舰队')}
        {p.fleet.length > 0 && <span> · {hull.percent}%</span>}
      </button>
    )}
  </section>;
}

export function VoyageBottomBar({ state, atHelm, onLog }: { state: GameState; atHelm: boolean; onLog: () => void }) {
  const { t } = useT();
  const action = endTurnAction(state, atHelm, gameController.lotteryRevealed);
  return <footer className="voyage-bottom"><VoyageLogButton onOpen={onLog} /><LogPanel state={state} log={gameController.visibleLogText(state)} tones={gameController.feedback.logTones} limit={3} /><button disabled={!action} onClick={() => { if (action) gameController[action](); }}>{t('End Turn', '结束回合')} ↪</button></footer>;
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
  return <header className="landing-heading"><div><small>⚓ {t('LANDFALL', '抵达')}</small><h2>{nodeName(node, locale)}</h2></div><div><strong>{owner ? t('Owned by {p}', '属于 {p}', { p: playerName(owner, locale) }) : t('Unowned', '无主之地')}</strong><p>{t('Treasury: {g}g', '金库：{g} 金币', { g: gameController.displayGold(player) })}</p></div></header>;
}
