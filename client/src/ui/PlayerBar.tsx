import type { GameState } from '@happy-voyage/shared';
import { RANKS, hasRoundLimit, requiresEveryIsland } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { cssColor } from './nations';
import { NavigatorPortrait } from './NavigatorPortrait';
import { SpeedControl } from './SpeedControl';
import { seatTag } from './seats';

/** Gold and colonies for every navigator; the current one is highlighted. */
export function PlayerBar({ state, onRules, onFleet }: { state: GameState; onRules: () => void; onFleet: () => void }) {
  return (
    <div className="panel players">
      <SpeedControl />
      <div className="player-header">
        <div className="round">
          Round {hasRoundLimit(state.config) ? `${Math.min(state.round, state.config.maxRounds)} / ${state.config.maxRounds}` : state.round} · goal:{' '}
          {requiresEveryIsland(state.config, islandCount(state)) ? `all ${state.config.islandsToWin} new continents` : `${state.config.islandsToWin} islands`}
        </div>
        <div className="player-controls">
          <button className="sound" onClick={() => gameController.toggleMute()} aria-pressed={!gameController.muted}>
            {gameController.muted ? 'Sound off' : 'Sound on'}
          </button>
          <button onClick={onFleet}>Fleet</button>
          <button onClick={onRules}>? Rules</button>
        </div>
      </div>
      <div className="player-list">
        {state.players.map((p) => (
          <div
            key={p.id}
            className={['player', p.id === state.currentPlayer && 'current', p.bankrupt && 'bankrupt'].filter(Boolean).join(' ')}
          >
            {p.navigator
              ? <NavigatorPortrait navigator={p.navigator} color={p.color} size={26} />
              : <span className="dot" style={{ background: cssColor(p.color) }} />}
            <strong>{p.name}</strong>
            <span className="tag">{gameController.room && gameController.viewerId === p.id ? 'You' : seatTag(state.players, p)}</span>
            <div className="stats">
              {RANKS[p.rank].name} ({RANKS[p.rank].chineseName})<br />
              {p.nation && <>{p.nation}<br /></>}
              {gameController.displayGold(p)}g · {islands(gameController.islandsOwnedBy(p.id))} · {p.fleet.length} {p.fleet.length === 1 ? 'ship' : 'ships'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const islandCount = (state: GameState) => state.map.filter((node) => node.kind === 'island').length;
const islands = (n: number) => `${n} island${n === 1 ? '' : 's'}`;
