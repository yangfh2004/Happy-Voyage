import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dialogPolyfill from 'dialog-polyfill';
import { GOODS, cargoLoad, goodName, nodeName, playerName, shipName, type GameState, type Good } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { gameController } from '../game/GameController';

export function TransferContents({ state }: { state: GameState }) {
  const player = state.players[state.currentPlayer];
  const { t, locale } = useT();
  const sn = (name: string) => shipName(name, locale);
  const gn = (good: Good) => goodName(good, locale);
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
      setError(cause instanceof Error ? cause.message : t('Transfer failed', '调度失败'));
    }
  }
  return <>
    <p>{nodeName(state.map[player.position], locale)} · {playerName(player, locale)}</p>
    {error && <p role="alert">{error}</p>}
    <h3>{t('Island dock', '岛屿码头')}</h3>
    {state.docks[player.position].length === 0 && <p>{t('No docked ships.', '没有停靠的船只。')}</p>}
    {state.docks[player.position].map((ship) => <p key={ship.id}>
      {sn(ship.name)} · {t('Cargo', '货物')} {cargoLoad(ship)}/{ship.cargoCapacity}{' '}
      <button onClick={() => act(() => gameController.boardShip(ship.id))}>{t('Board {s}', '让{s}归队', { s: sn(ship.name) })}</button>
    </p>)}
    <h3>{t('Fleet ships', '舰队船只')}</h3>
    <label>{t('Load onto ship', '装货船只')}{' '}
      <select value={selected?.id ?? ''} onChange={(event) => setSelectedId(Number(event.target.value))}>
        {player.fleet.map((ship) => <option key={ship.id} value={ship.id}>{sn(ship.name)}</option>)}
      </select>
    </label>{' '}
    <label>{t('Amount', '数量')} <input type="number" min="1" step="1" value={qty} onChange={(event) => setQty(Number(event.target.value))} /></label>
    {player.fleet.map((ship) => <section key={ship.id} aria-label={sn(ship.name)}>
      <h4>{sn(ship.name)} · {t('Cargo', '货物')} {cargoLoad(ship)}/{ship.cargoCapacity}</h4>
      <button disabled={player.fleet.length <= 1} onClick={() => act(() => gameController.dockShip(ship.id))}>{t('Dock {s}', '停靠{s}', { s: sn(ship.name) })}</button>
      {GOODS.filter((good) => (ship.cargo[good] ?? 0) > 0).map((good) => <p key={good}>
        {gn(good)}{t(': ', '：')}{ship.cargo[good]}{' '}
        <button onClick={() => act(() => gameController.unloadCargo(ship.id, good, qty))}>{t('Unload {g} from {s}', '从{s}卸下{g}', { g: gn(good), s: sn(ship.name) })}</button>{' '}
        <button onClick={() => act(() => gameController.unloadCargo(ship.id, good, ship.cargo[good]!))}>{t('Unload all {g} from {s}', '从{s}卸下全部{g}', { g: gn(good), s: sn(ship.name) })}</button>
      </p>)}
    </section>)}
    <h3>{t('Colony stock', '殖民地库存')}</h3>
    {GOODS.map((good) => {
      const stored = good === 'lumber' || good === 'iron' ? stock[good] : stock.specialties[good] ?? 0;
      return <p key={good}>{gn(good)}{t(': ', '：')}{stored}{' '}
        <button disabled={!selected || stored === 0} onClick={() => act(() => gameController.loadCargo(selected!.id, good, qty))}>{t('Load {g}', '装载{g}', { g: gn(good) })}</button>
      </p>;
    })}
    <button onClick={() => act(() => gameController.autoLoad())}>{t('AUTO load specialties', '自动装载特产')}</button>
  </>;
}

export function TransferPanel({ state, onClose }: { state: GameState; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const { t } = useT();
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
      <h2 id="transfers-title">{t('Transfers', '调度')}</h2>
      <button type="button" onClick={() => dialog.current?.close()}>{t('Close', '关闭')}</button>
    </div>
    <TransferContents state={state} />
  </dialog>, document.body);
}
