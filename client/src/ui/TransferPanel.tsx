import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dialogPolyfill from 'dialog-polyfill';
import { GOODS, cargoLoad, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';

export function TransferContents({ state }: { state: GameState }) {
  const player = state.players[state.currentPlayer];
  const [selectedId, setSelectedId] = useState(player.fleet[0]?.id);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');
  const selected = player.fleet.find((ship) => ship.id === selectedId) ?? player.fleet[0];
  const stock = state.stockpiles[player.position];
  function act(action: () => void) {
    try {
      action();
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Transfer failed');
    }
  }
  return <>
    <p>{state.map[player.position].name} · {player.name}</p>
    {error && <p role="alert">{error}</p>}
    <h3>Island dock</h3>
    {state.docks[player.position].length === 0 && <p>No docked ships.</p>}
    {state.docks[player.position].map((ship) => <p key={ship.id}>
      {ship.name} · Cargo {cargoLoad(ship)}/{ship.cargoCapacity}{' '}
      <button onClick={() => act(() => gameController.boardShip(ship.id))}>Board {ship.name}</button>
    </p>)}
    <h3>Fleet ships</h3>
    <label>Load onto ship{' '}
      <select value={selected?.id ?? ''} onChange={(event) => setSelectedId(Number(event.target.value))}>
        {player.fleet.map((ship) => <option key={ship.id} value={ship.id}>{ship.name}</option>)}
      </select>
    </label>{' '}
    <label>Amount <input type="number" min="1" step="1" value={qty} onChange={(event) => setQty(Number(event.target.value))} /></label>
    {player.fleet.map((ship) => <section key={ship.id} aria-label={ship.name}>
      <h4>{ship.name} · Cargo {cargoLoad(ship)}/{ship.cargoCapacity}</h4>
      <button disabled={player.fleet.length <= 1} onClick={() => act(() => gameController.dockShip(ship.id))}>Dock {ship.name}</button>
      {GOODS.filter((good) => (ship.cargo[good] ?? 0) > 0).map((good) => <p key={good}>
        {good}: {ship.cargo[good]}{' '}
        <button onClick={() => act(() => gameController.unloadCargo(ship.id, good, qty))}>Unload {good} from {ship.name}</button>{' '}
        <button onClick={() => act(() => gameController.unloadCargo(ship.id, good, ship.cargo[good]!))}>Unload all {good} from {ship.name}</button>
      </p>)}
    </section>)}
    <h3>Colony stock</h3>
    {GOODS.map((good) => {
      const stored = good === 'lumber' || good === 'iron' ? stock[good] : stock.specialties[good] ?? 0;
      return <p key={good}>{good}: {stored}{' '}
        <button disabled={!selected || stored === 0} onClick={() => act(() => gameController.loadCargo(selected!.id, good, qty))}>Load {good}</button>
      </p>;
    })}
    <button onClick={() => act(() => gameController.autoLoad())}>AUTO load specialties</button>
  </>;
}

export function TransferPanel({ state, onClose }: { state: GameState; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogPolyfill.registerDialog(element);
    element.showModal();
  }, []);
  function closePanel() {
    onClose();
    previousFocus.current?.focus();
  }
  return createPortal(<dialog className="panel fleet" ref={dialog} onClose={closePanel} onKeyDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="transfers-title">
    <div className="fleet-heading">
      <h2 id="transfers-title">Transfers</h2>
      <button type="button" onClick={() => dialog.current?.close()}>Close</button>
    </div>
    <TransferContents state={state} />
  </dialog>, document.body);
}
