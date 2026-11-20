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
