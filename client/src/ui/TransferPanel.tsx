import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dialogPolyfill from 'dialog-polyfill';
import { GOODS, MAX_FLEET_SIZE, cargoLoad, colonyCanRepair, goodName, nodeName, playerName, shipName, type GameState, type Good, type Ship } from '@happy-voyage/shared';
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
  const selected = player.fleet.find((ship) => ship.id === selectedId) ?? player.fleet[0];
  const stock = state.stockpiles[player.position];
  const docked = state.docks[player.position];
  const fleetFull = player.fleet.length >= MAX_FLEET_SIZE;
  const specialtyStock = Object.values(stock.specialties).reduce((sum, qty) => sum + (qty ?? 0), 0);
  const freeCargo = player.fleet.reduce((sum, ship) => sum + ship.cargoCapacity - cargoLoad(ship), 0);
  const autoLoadable = Math.min(specialtyStock, freeCargo);
  const storedOf = (good: Good) => good === 'lumber' || good === 'iron' ? stock[good] : stock.specialties[good] ?? 0;
  const goodsHere = GOODS.filter((good) => storedOf(good) > 0 || (selected?.cargo[good] ?? 0) > 0);
  const selectedFree = selected ? selected.cargoCapacity - cargoLoad(selected) : 0;
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
  function moveCargo(direction: 'load' | 'unload', good: Good, amount: number) {
    if (!selected) return;
    const limit = direction === 'load' ? Math.min(storedOf(good), selectedFree) : selected.cargo[good] ?? 0;
    if (!Number.isSafeInteger(amount) || amount <= 0) setError(t('Enter a whole number above 0.', '请输入大于 0 的整数。'));
    else if (amount > limit) setError(direction === 'load'
      ? t('Can load at most {n} {g}: limited by colony stock and free cargo space.', '最多可装载 {n} 单位{g}：受殖民地库存和空余货舱限制。', { n: limit, g: gn(good) })
      : t('Only {n} {g} aboard.', '船上只有 {n} 单位{g}。', { n: limit, g: gn(good) }));
    else act(() => direction === 'load' ? gameController.loadCargo(selected.id, good, amount) : gameController.unloadCargo(selected.id, good, amount));
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > limit) setNotice('');
  }
  const cargoSummary = (ship: Ship) => {
    const goods = GOODS.filter((good) => (ship.cargo[good] ?? 0) > 0);
    return goods.length ? goods.map((good) => `${gn(good)} ${ship.cargo[good]}`).join(t(', ', '、')) : t('Empty hold', '空舱');
  };
  const shipCard = (ship: Ship, action: ReactNode) => <li key={ship.id} className="transfer-ship">
    <div>
      <strong>{sn(ship.name)}</strong>
      <small><StatTooltip stat="durability">{t('Durability', '耐久')} {ship.durability}/{ship.maxDurability}</StatTooltip></small>
      <small><StatTooltip stat="cargoCapacity">{t('Cargo', '货物')} {cargoLoad(ship)}/{ship.cargoCapacity}</StatTooltip> · {cargoSummary(ship)}</small>
    </div>
    {action}
  </li>;
  return <>
    <p className="transfer-place">{nodeName(state.map[player.position], locale)} · {playerName(player, locale)}</p>
    <section className="transfer-section" aria-labelledby="transfer-ships-heading">
      <h3 id="transfer-ships-heading">{t('Ships', '船只调度')}</h3>
      <p className="transfer-hint">{t('Docked ships stay to defend this colony; board them to sail again.', '停靠的船只留下守卫殖民地；让它们归队即可再次出航。')}{' '}
        {colonyCanRepair(state, player.position)
          ? t('Dock ships here for free repairs at the start of your next turn.', '将船只停靠在此，下次回合开始时免费修好。')
          : t('No shipyard or repair yard: docked ships are not repaired here.', '没有造船厂或修船厂，停靠的船只不会在此修理。')}</p>
      <div className="transfer-columns">
        <div>
          <h4>{t('Fleet {n}/{max}', '舰队 {n}/{max}', { n: player.fleet.length, max: MAX_FLEET_SIZE })}</h4>
          <ul>{player.fleet.map((ship) => shipCard(ship,
            <button disabled={player.fleet.length <= 1} onClick={() => act(() => gameController.dockShip(ship.id))}>{t('Dock {s}', '停靠{s}', { s: sn(ship.name) })}</button>))}</ul>
        </div>
        <div>
          <h4>{t('Docked ships', '停靠船只')} ({docked.length})</h4>
          {docked.length === 0 && <p className="transfer-hint">{t('No docked ships.', '没有停靠的船只。')}</p>}
          {fleetFull && docked.length > 0 && <p className="transfer-hint">{t('The fleet is full. Dock a fleet ship before boarding another.', '舰队已满。先停靠一艘随行船只，再让另一艘归队。')}</p>}
          <ul>{docked.map((ship) => shipCard(ship,
            <button disabled={fleetFull} onClick={() => act(() => gameController.boardShip(ship.id))}>{t('Board {s}', '让{s}归队', { s: sn(ship.name) })}</button>))}</ul>
        </div>
      </div>
    </section>
    <section className="transfer-section" aria-labelledby="transfer-cargo-heading">
      <h3 id="transfer-cargo-heading">{t('Cargo', '资源调度')}</h3>
      <div className="transfer-quick">
        <button className="primary" disabled={autoLoadable === 0} onClick={() => act(() => gameController.autoLoad(), t('Loaded {n} specialty units onto the fleet.', '已将 {n} 单位特产装上舰队。', { n: autoLoadable }))}>{t('AUTO load specialties', '自动装载特产')}</button>
        <small>{specialtyStock === 0 ? t('No specialties in stock. Build a Collection Field here to produce them.', '库存没有特产。在此建造采集场即可生产特产。')
          : freeCargo === 0 ? t('The fleet has no free cargo space.', '舰队货舱已满。')
          : t('Fills free cargo space with specialties; lumber and iron stay here.', '用特产装满空余货舱；木材和铁矿留在殖民地。')}</small>
      </div>
      <div className="transfer-controls">
        <label>{t('Ship', '船只')}{' '}
          <select value={selected?.id ?? ''} onChange={(event) => setSelectedId(Number(event.target.value))}>
            {player.fleet.map((ship) => <option key={ship.id} value={ship.id}>{sn(ship.name)} · {cargoLoad(ship)}/{ship.cargoCapacity}</option>)}
          </select>
        </label>
        <label>{t('Amount', '数量')} <input type="number" min="1" step="1" value={qty} onChange={(event) => setQty(Number(event.target.value))} /></label>
      </div>
      {goodsHere.length === 0 ? <p className="transfer-hint">{t('No goods in the colony or aboard this ship.', '殖民地和这艘船上都没有货物。')}</p> :
        <table className="transfer-goods">
          <thead><tr>
            <th scope="col">{t('Good', '货物')}</th>
            <th scope="col"><StatTooltip stat="storage">{t('Colony', '殖民地')}</StatTooltip></th>
            <th scope="col">{t('Aboard', '船上')}</th>
            <th scope="col"><span className="visually-hidden">{t('Actions', '操作')}</span></th>
          </tr></thead>
          <tbody>{goodsHere.map((good) => {
            const stored = storedOf(good);
            const aboard = selected?.cargo[good] ?? 0;
            const names = { g: gn(good), s: selected ? sn(selected.name) : '' };
            return <tr key={good}>
              <th scope="row">{gn(good)}</th>
              <td>{stored}</td>
              <td>{aboard}</td>
              <td className="transfer-actions">
                <button disabled={!selected || stored === 0 || selectedFree === 0} aria-label={t('Load {g} onto {s}', '将{g}装上{s}', names)} onClick={() => moveCargo('load', good, qty)}>{t('Load', '装载')}</button>
                <button disabled={aboard === 0} aria-label={t('Unload {g} from {s}', '从{s}卸下{g}', names)} onClick={() => moveCargo('unload', good, qty)}>{t('Unload', '卸下')}</button>
                <button disabled={aboard === 0} aria-label={t('Unload all {g} from {s}', '从{s}卸下全部{g}', names)} onClick={() => moveCargo('unload', good, aboard)}>{t('All', '全部')}</button>
              </td>
            </tr>;
          })}</tbody>
        </table>}
    </section>
    <div className="transfer-feedback">
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
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
      <h2 id="transfers-title">{t('Ships & cargo transfer', '船只与资源调度')}</h2>
      <button type="button" onClick={() => dialog.current?.close()}>{t('Close', '关闭')}</button>
    </div>
    <TransferContents state={state} />
  </dialog>, document.body);
}
