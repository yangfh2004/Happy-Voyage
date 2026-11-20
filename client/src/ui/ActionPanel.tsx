import type { GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';

const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/** What the human can do right now: roll, claim or decline, or start over. */
export function ActionPanel({ state }: { state: GameState }) {
  const player = state.players[state.currentPlayer];
  const dice = state.lastRoll && (
    <div className="dice" aria-label={`Rolled ${state.lastRoll[0]} and ${state.lastRoll[1]}`}>
      {DIE_FACES[state.lastRoll[0]]} {DIE_FACES[state.lastRoll[1]]}
    </div>
  );

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
          <tbody>{state.players.map((p) => {
            const colonies = state.map.filter((node) => state.owners[node.id] === p.id);
            return { ...p, islands: colonies.length, worth: p.gold + colonies.reduce((sum, node) => sum + (node.price ?? 0), 0) };
          }).sort((a, b) => Number(b.id === state.winner) - Number(a.id === state.winner)
            || Number(a.bankrupt) - Number(b.bankrupt) || b.worth - a.worth || a.id - b.id).map((p) => (
            <tr key={p.id}><th>{p.name}{!p.isAI && ' (You)'}</th><td>{p.gold}g</td><td>{p.islands}</td><td>{p.worth}g</td><td>{p.bankrupt ? 'Bankrupt' : p.id === state.winner ? 'Winner' : 'Afloat'}</td></tr>
          ))}</tbody>
        </table>
        <button className="primary" onClick={() => gameController.quit()}>
          New voyage
        </button>
      </>
    );
  } else if (player.isAI) {
    body = <p className="waiting">{player.name} is at the helm…</p>;
  } else if (state.phase === 'awaitingRoll') {
    body = (
      <>
        <p>Your turn, {player.name}.</p>
        <button className="primary big" onClick={() => gameController.roll()}>
          Roll dice
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
      {dice}
      {body}
    </div>
  );
}
