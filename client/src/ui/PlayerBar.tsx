import type { GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { cssColor } from './nations';
import { SpeedControl } from './SpeedControl';

/** Gold and colonies for every navigator; the current one is highlighted. */
export function PlayerBar({ state, onRules, onFleet }: { state: GameState; onRules: () => void; onFleet: () => void }) {
  return (
    <div className="panel players">
      <SpeedControl />
      <div className="player-header">
        <div className="round">
          Round {Math.min(state.round, state.config.maxRounds)} / {state.config.maxRounds} · goal: {state.config.islandsToWin}{' '}
          islands
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
            <span className="dot" style={{ background: cssColor(p.color) }} />
            <strong>{p.name}</strong>
            <span className="tag">{p.isAI ? 'AI' : 'You'}</span>
            <div className="stats">
              {!p.isAI && p.nation && <>{p.nation}<br /></>}
              {p.gold}g · {islands(gameController.islandsOwnedBy(p.id))} · {p.fleet.length} {p.fleet.length === 1 ? 'ship' : 'ships'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const islands = (n: number) => `${n} island${n === 1 ? '' : 's'}`;
