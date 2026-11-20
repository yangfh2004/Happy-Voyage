import { useState } from 'react';
import type { GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';

export function SeaChoicePanel({ state }: { state: GameState }) {
  const [destination, setDestination] = useState(String(state.players[state.currentPlayer].position));
  const [error, setError] = useState('');
  const act = (action: () => void) => {
    try { action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sea encounter failed'); }
  };
  return <section className="sea-choice" aria-labelledby="sea-choice-title">
    {state.phase === 'awaitingMerchant' && state.pendingMerchant && <>
      <h2 id="sea-choice-title">¤ Merchant ship · Premium trade</h2>
      <p>Sell {state.pendingMerchant.quantity} {state.pendingMerchant.good} from your fleet for <strong>{state.pendingMerchant.gold}g</strong>?</p>
      <button className="primary" onClick={() => act(() => gameController.acceptMerchant())}>Accept merchant offer</button>
      <button onClick={() => gameController.declineMerchant()}>Decline merchant offer</button>
    </>}
    {state.phase === 'awaitingWyvern' && <>
      <h2 id="sea-choice-title">W Wyvern · Choose your destination</h2>
      <p>Fly to any stop. Its landing effect will resolve when you arrive.</p>
      <label htmlFor="wyvern-destination">Destination</label>{' '}
      <select id="wyvern-destination" value={destination} onChange={(e) => setDestination(e.target.value)}>
        {state.map.map((node) => <option key={node.id} value={node.id}>{node.id + 1}. {node.name} · {node.event ?? node.special ?? node.kind}</option>)}
      </select>
      <button className="primary" onClick={() => act(() => gameController.wyvernFly(Number(destination)))}>Fly with wyvern</button>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
