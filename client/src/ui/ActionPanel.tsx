import { colonyValue, type GameState } from '@happy-voyage/shared';
import { ANIMATION_SPEEDS, gameController } from '../game/GameController';
import { Compass } from './Compass';

/** What the human can do right now: spin, claim or decline, or start over. */
export function ActionPanel({ state }: { state: GameState }) {
  const player = state.players[state.currentPlayer];
  const spinning = state.phase === 'spinning';
  const animating = spinning || state.phase === 'moving';

  let body;
  if (state.phase === 'gameOver') {
    const winner = state.players[state.winner!];
    body = (
      <>
        <h2>{winner.isAI ? `${winner.name} wins the seas.` : 'Victory! The crown celebrates you.'}</h2>
        <p>{state.log[state.log.length - 1]}</p>
        <table className="standings">
          <caption>Final standings · winner first, then afloat navigators by net worth</caption>
          <thead><tr><th>Navigator</th><th>Gold</th><th>Islands</th><th>Net worth</th><th>Status</th></tr></thead>
          <tbody>{state.players.map((p) => ({
            ...p,
            islands: gameController.islandsOwnedBy(p.id),
            worth: gameController.netWorth(p.id),
          })).sort((a, b) => Number(b.id === state.winner) - Number(a.id === state.winner)
            || Number(a.bankrupt) - Number(b.bankrupt) || b.worth - a.worth || a.id - b.id).map((p) => (
            <tr key={p.id}><th>{p.name}{!p.isAI && ' (You)'}</th><td>{p.gold}g</td><td>{p.islands}</td><td>{p.worth}g</td><td>{p.bankrupt ? 'Bankrupt' : p.id === state.winner ? 'Winner' : 'Afloat'}</td></tr>
          ))}</tbody>
        </table>
        <button className="primary" onClick={() => gameController.quit()}>
          New voyage
        </button>
      </>
    );
  } else if (spinning) {
    body = <p className="waiting">{player.isAI ? `${player.name} spins the compass.` : 'Your compass is spinning.'}</p>;
  } else if (player.isAI) {
    body = <p className="waiting">{player.name} is at the helm…</p>;
  } else if (state.phase === 'awaitingSpin') {
    body = (
      <>
        <p>Your turn, {player.name}.</p>
        <button className="primary big" onClick={() => gameController.spinCompass()}>
          Spin compass
        </button>
      </>
    );
  } else if (state.phase === 'awaitingClaim') {
    const island = state.map[state.pendingClaim!];
    body = (
      <>
        <h2>{island.name}</h2>
        <p>
          Uncharted land rich in <strong>{island.specialty}</strong>. Found a colony for <strong>{island.price}g</strong>?
          Rivals landing here will pay you {island.toll}g.
        </p>
        <p>
          Claiming leaves you {player.gold - island.price!}g in cash. This colony adds {colonyValue(island)}g to your final score.
        </p>
        <div className="row">
          <button className="primary" onClick={() => gameController.claim()}>
            Claim ({island.price}g)
          </button>
          <button onClick={() => gameController.decline()}>Sail on</button>
        </div>
      </>
    );
  } else {
    body = <p className="waiting">Sailing…</p>;
  }

  return (
    <div className="panel actions">
      {state.phase === 'gameOver' ? body : (
        <>
          <div className="action-content">
            <Compass
              result={state.lastSpin}
              spinning={spinning}
              duration={gameController.spinDuration}
              onSettled={() => gameController.finishSpin()}
            />
            <div>{body}</div>
          </div>
          <div className="animation-controls">
            <label>
              Animation speed
              <select
                value={gameController.animationSpeed}
                disabled={animating}
                onChange={(event) => {
                  const speed = ANIMATION_SPEEDS.find((value) => String(value) === event.target.value);
                  if (speed !== undefined) gameController.setAnimationSpeed(speed);
                }}
              >
                {ANIMATION_SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
              </select>
            </label>
            <button disabled={!animating} onClick={() => gameController.skipAnimation()}>Skip animation</button>
          </div>
        </>
      )}
    </div>
  );
}
