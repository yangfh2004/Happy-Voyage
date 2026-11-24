import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dialogPolyfill from 'dialog-polyfill';
import { GOODS, MAX_FLEET_SIZE, cargoLoad, colonyCanRepair, goodName, nodeName, playerName, shipName, type GameState, type Good } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { gameController } from '../game/GameController';
import { StatTooltip } from './StatTooltip';

export function TransferContents({ state }: { state: GameState }) {
  const player = state.players[state.currentPlayer];
  const { t, locale } = useT();
  const sn = (name: string) => shipName(name, locale);
  const gn = (good: Good) => goodName(good, locale);
  const [selectedId, setSelectedId] = useState(player.fleet[0]?.id);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    noticeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [notice]);
  const selected = player.fleet.find((ship) => ship.id === selectedId) ?? player.fleet[0];
  const stock = state.stockpiles[player.position];
  const fleetFull = player.fleet.length >= MAX_FLEET_SIZE;
  const specialtyStock = Object.values(stock.specialties).reduce((sum, qty) => sum + (qty ?? 0), 0);
  const freeCargo = player.fleet.reduce((sum, ship) => sum + ship.cargoCapacity - cargoLoad(ship), 0);
  const autoLoadable = Math.min(specialtyStock, freeCargo);
  function act(action: () => void, success = '') {
    try {
      action();
      setError('');
      setNotice(success);
    } catch (cause) {
      setNotice('');
      setError(cause instanceof Error ? cause.message : t('Transfer failed', '调度失败'));
    }
  }
  return <>
    <p>{nodeName(state.map[player.position], locale)} · {playerName(player, locale)}</p>
    {error && <p role="alert">{error}</p>}
    <h3>{t('Colony shipyard', '殖民地船坞')}</h3>
    {colonyCanRepair(state, player.position) && <p>{t('Dock ships here for free repairs at the start of your next turn.', '将船只停靠在此，下次回合开始时免费修好。')}</p>}
    {state.docks[player.position].length === 0 && <p>{t('No docked ships.', '没有停靠的船只。')}</p>}
    {fleetFull && state.docks[player.position].length > 0 && <p>{t('The fleet is full. Dock a fleet ship before boarding another.', '舰队已满。先停靠一艘随行船只，再让另一艘归队。')}</p>}
    {state.docks[player.position].map((ship) => <p key={ship.id}>
      {sn(ship.name)} · <StatTooltip stat="cargoCapacity">{t('Cargo', '货物')} {cargoLoad(ship)}/{ship.cargoCapacity}</StatTooltip>{' '}
      <button disabled={fleetFull} onClick={() => act(() => gameController.boardShip(ship.id))}>{t('Board {s}', '让{s}归队', { s: sn(ship.name) })}</button>
    </p>)}
    <h3>{t('Fleet {n}/{max}', '舰队 {n}/{max}', { n: player.fleet.length, max: MAX_FLEET_SIZE })}</h3>
    <label>{t('Load onto ship', '装货船只')}{' '}
      <select value={selected?.id ?? ''} onChange={(event) => setSelectedId(Number(event.target.value))}>
        {player.fleet.map((ship) => <option key={ship.id} value={ship.id}>{sn(ship.name)}</option>)}
      </select>
    </label>{' '}
    <label>{t('Amount', '数量')} <input type="number" min="1" step="1" value={qty} onChange={(event) => setQty(Number(event.target.value))} /></label>
    {player.fleet.map((ship) => <section key={ship.id} aria-label={sn(ship.name)}>
      <h4>{sn(ship.name)} · <StatTooltip stat="cargoCapacity">{t('Cargo', '货物')} {cargoLoad(ship)}/{ship.cargoCapacity}</StatTooltip></h4>
      <button disabled={player.fleet.length <= 1} onClick={() => act(() => gameController.dockShip(ship.id))}>{t('Dock {s}', '停靠{s}', { s: sn(ship.name) })}</button>
      {GOODS.filter((good) => (ship.cargo[good] ?? 0) > 0).map((good) => <p key={good}>
        {gn(good)}{t(': ', '：')}{ship.cargo[good]}{' '}
        <button onClick={() => act(() => gameController.unloadCargo(ship.id, good, qty))}>{t('Unload {g} from {s}', '从{s}卸下{g}', { g: gn(good), s: sn(ship.name) })}</button>{' '}
        <button onClick={() => act(() => gameController.unloadCargo(ship.id, good, ship.cargo[good]!))}>{t('Unload all {g} from {s}', '从{s}卸下全部{g}', { g: gn(good), s: sn(ship.name) })}</button>
      </p>)}
    </section>)}
    <h3><StatTooltip stat="storage">{t('Colony stock', '殖民地库存')}</StatTooltip></h3>
    {GOODS.map((good) => {
      const stored = good === 'lumber' || good === 'iron' ? stock[good] : stock.specialties[good] ?? 0;
      return <p key={good}>{gn(good)}{t(': ', '：')}{stored}{' '}
        <button disabled={!selected || stored === 0} onClick={() => act(() => gameController.loadCargo(selected!.id, good, qty))}>{t('Load {g}', '装载{g}', { g: gn(good) })}</button>
      </p>;
    })}
    <button disabled={autoLoadable === 0} onClick={() => act(() => gameController.autoLoad(), t('Loaded {n} specialty units onto the fleet.', '已将 {n} 单位特产装上舰队。', { n: autoLoadable }))}>{t('AUTO load specialties', '自动装载特产')}</button>
    {notice && <p ref={noticeRef} role="status">{notice}</p>}
    {specialtyStock === 0 ? <p>{t('No specialties in stock. Build a Collection Field here to produce them.', '库存没有特产。在此建造采集场即可生产特产。')}</p>
      : freeCargo === 0 && <p>{t('The fleet has no free cargo space.', '舰队货舱已满。')}</p>}
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
