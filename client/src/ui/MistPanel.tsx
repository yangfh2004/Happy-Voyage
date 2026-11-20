import { HERMITS, NIM_MAX_TAKE, SEA_RULES, STRATEGIES, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';

const stoneCount = (count: number) => `${count} stone${count === 1 ? '' : 's'}`;

export function MistPanel({ state }: { state: GameState }) {
  const duel = state.mistDuel;
  if (!duel) return null;
  const { stonesLeft, lastTurn, result } = duel;
  const hermit = HERMITS.find(({ id }) => id === duel.hermitId);

  return <section aria-labelledby="mist-title" className="mist">
    <h2 id="mist-title">Mist Island duel · 迷雾岛</h2>
    <p>Take 1–{NIM_MAX_TAKE} stones in a row from the end. Whoever takes the last stone loses.</p>
    {!hermit ? <>
      <p>Choose a hermit to challenge. Win to learn their strategy.</p>
      <div className="row mist-choices" role="group" aria-label="Choose a hermit">
        {HERMITS.map(({ id, name, style, reward }) => (
          <button key={id} onClick={() => gameController.challengeHermit(id)}>
            <strong>{name}</strong>
            <small>{style} · teaches {STRATEGIES[reward].name}</small>
          </button>
        ))}
      </div>
      <button onClick={() => gameController.leaveMistIsland()}>Sail on</button>
    </> : <>
      <h3>{hermit.name}</h3>
      <div className="mist-stones" aria-hidden="true">
        {Array.from({ length: SEA_RULES.nimStones }, (_, i) => (
          <span key={i} className={i < stonesLeft ? 'mist-stone' : 'mist-stone taken'} />
        ))}
      </div>
      <div role="status">
        {lastTurn && <p>You took {stoneCount(lastTurn.playerTake)}.{lastTurn.hermitTake !== null &&
          ` ${hermit.name} took ${stoneCount(lastTurn.hermitTake)}.`}</p>}
        {result ? result.outcome === 'win' ? <>
          <p><strong>You win!</strong> {hermit.name} took the last stone.</p>
          <p>Won {SEA_RULES.nimPrize}g. {result.strategy
            ? `Strategy learned: ${STRATEGIES[result.strategy].name}.`
            : `Your hand is full; ${STRATEGIES[hermit.reward].name} was discarded.`}</p>
        </> : <p><strong>You lose.</strong> You took the last stone.</p>
          : <p><strong>{stoneCount(stonesLeft)} left</strong> · Your move</p>}
      </div>
      {result ? <button className="primary" onClick={() => gameController.leaveMistIsland()}>Sail on</button>
        : <div className="row mist-choices" role="group" aria-label="Take stones">
          {Array.from({ length: NIM_MAX_TAKE }, (_, i) => i + 1).map((count) => (
            <button key={count} className="primary" disabled={count > stonesLeft} onClick={() => gameController.takeMistStones(count)}>
              Take {stoneCount(count)}
            </button>
          ))}
        </div>}
    </>}
  </section>;
}
