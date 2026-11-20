import { useState } from 'react';
import { GOOD_VALUES, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';

export function BarterPanel({ state }: { state: GameState }) {
  const [error, setError] = useState('');
  function accept(index: number) {
    try { gameController.acceptBarter(index); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Barter failed'); }
  }
  return <section aria-labelledby="barter-title">
    <h2 id="barter-title">Wind Island · Native barter</h2>
    <p>Trade cheap fleet cargo for higher-value goods. Choose one offer or sail on.</p>
    {error && <p role="alert">{error}</p>}
    {(state.pendingBarter ?? []).map((offer, index) => <div className="building-option" key={index}>
      <p>Give {offer.giveQty} {offer.give} ({offer.giveQty * GOOD_VALUES[offer.give]}g value)</p>
      <p>Receive {offer.receiveQty} {offer.receive} ({offer.receiveQty * GOOD_VALUES[offer.receive]}g value)</p>
      <button className="primary" onClick={() => accept(index)}>Accept offer {index + 1}</button>
    </div>)}
    <button onClick={() => gameController.declineBarter()}>Decline barter</button>
  </section>;
}
