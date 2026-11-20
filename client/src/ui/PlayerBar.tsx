import type { ReactNode } from 'react';
import type { GameState } from '@happy-voyage/shared';
import { chartIdentity, hasRoundLimit, nationName, playerName, rankName, requiresEveryIsland } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { LanguageSwitch } from './LanguageSwitch';
import { gameController } from '../game/GameController';
import { cssColor } from './nations';
import { NavigatorPortrait } from './NavigatorPortrait';
import { SoundControl } from './SoundControl';
import { SpeedControl } from './SpeedControl';
import { seatTag } from './seats';
import { StatTooltip } from './StatTooltip';

/** Gold and colonies for every navigator; the current one is highlighted. */
export function PlayerBar({ state, colorBlind, paletteToggle, onRules, onFleet, onTutorial }: { state: GameState; colorBlind: boolean; paletteToggle: ReactNode; onRules: () => void; onFleet: () => void; onTutorial: () => void }) {
  const { t, locale } = useT();
  const islands = (n: number) => t(`{n} island${n === 1 ? '' : 's'}`, '{n} 座岛屿', { n });
  return (
    <div className="panel players">
      <SpeedControl />
      <LanguageSwitch />
      <SoundControl />
      <div className="player-header">
        <div className="round">
          <StatTooltip stat="round">{t('Round {r}', '第 {r} 回合', { r: hasRoundLimit(state.config) ? `${Math.min(state.round, state.config.maxRounds)} / ${state.config.maxRounds}` : state.round })}</StatTooltip> ·{' '}
          <StatTooltip stat="goal">{t('goal: {goal}', '目标：{goal}', {
            goal: state.campaign ? t('king’s missions', '国王使命') : requiresEveryIsland(state.config, islandCount(state))
              ? t('all {n} new continents', '全部 {n} 块新大陆', { n: state.config.islandsToWin }) : islands(state.config.islandsToWin),
          })}</StatTooltip>
        </div>
        <div className="player-controls">
          <button onClick={onFleet}>{t('Fleet', '舰队')}</button>
          <button onClick={onTutorial}>{t('Tutorial', '教程')}</button>
          <button onClick={onRules}>{t('? Rules', '? 规则')}</button>
          {paletteToggle}
        </div>
      </div>
      <div className="player-list">
        {state.players.map((p) => {
          const { color, badge } = chartIdentity(p, colorBlind);
          return (
          <div
            key={p.id}
            className={['player', p.id === state.currentPlayer && 'current', p.bankrupt && 'bankrupt'].filter(Boolean).join(' ')}
          >
            {p.navigator
              ? <NavigatorPortrait navigator={p.navigator} color={color} size={26} />
              : <span className="dot" style={{ background: cssColor(color) }} />}
            {badge && <span className="chart-badge" aria-label={t('Chart marker {n}', '海图标记 {n}', { n: badge })}>{badge}</span>}
            <strong>{playerName(p, locale)}</strong>
            <span className="tag">{gameController.room && gameController.viewerId === p.id ? t('You', '你') : seatTag(state.players, p)}</span>
            <div className="stats">
              <StatTooltip stat="rank">{rankName(p.rank, locale)}</StatTooltip><br />
              {p.nation && <>{nationName(p.nation, locale)}<br /></>}
              <StatTooltip stat="gold">{t('{g}g', '{g} 金币', { g: gameController.displayGold(p) })}</StatTooltip> · <StatTooltip stat="islands">{islands(gameController.islandsOwnedBy(p.id))}</StatTooltip> · <StatTooltip stat="ships">{t(`{n} ${p.fleet.length === 1 ? 'ship' : 'ships'}`, '{n} 艘船', { n: p.fleet.length })}</StatTooltip>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

const islandCount = (state: GameState) => state.map.filter((node) => node.kind === 'island').length;
