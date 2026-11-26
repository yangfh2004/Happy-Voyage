import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CAPTAINS, GAMEPLAY_TUNING, captainDescriptionText, captainName, cargoLoad, colonyCanRepair,
  goodName, nodeName, playerName, rankName, shipName, shipTypeName,
  type GameState, type Good, type Player, type Ship,
} from '@happy-voyage/shared';
import { useT } from '../i18n';
import dialogPolyfill from 'dialog-polyfill';
import { gameController } from '../game/GameController';
import { fleetDurabilitySummary } from './fleetSummary';
import { seatTag } from './seats';
import { StatTooltip } from './StatTooltip';

export { fleetDurabilitySummary, type FleetSummary } from './fleetSummary';

function ShipRows({ ships }: { ships: readonly Ship[] }) {
  const { t, locale } = useT();
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t('Ship', '船只')}</th>
          <th scope="col"><StatTooltip stat="durability" /></th>
          <th scope="col"><StatTooltip stat="firepower" /></th>
          <th scope="col"><StatTooltip stat="cargoCapacity" /></th>
          <th scope="col"><StatTooltip stat="speed" /></th>
          <th scope="col"><StatTooltip stat="crewCapacity" /></th>
        </tr>
      </thead>
      <tbody>
        {ships.map((ship) => {
          const pct = ship.maxDurability > 0 ? Math.round((ship.durability / ship.maxDurability) * 100) : 0;
          const isDamaged = ship.durability < ship.maxDurability;
          return (
            <tr key={ship.id} className={isDamaged ? 'damaged' : undefined}>
              <th scope="row">
                {ship.signature && <span aria-label={t('Signature ship', '特色船只')} title={t('Signature ship', '特色船只')}>★ </span>}
                {shipName(ship.name, locale)}
                <small>{shipTypeName(ship.type, locale)}{ship.signature && t(' · signature ship', ' · 特色船只')}</small>
              </th>
              <td>
                <div className="fleet-durability">
                  <meter
                    aria-label={t('{ship} durability', '{ship}的耐久', { ship: shipName(ship.name, locale) })}
                    min={0}
                    max={ship.maxDurability}
                    low={Math.ceil(ship.maxDurability * 0.35)}
                    high={Math.ceil(ship.maxDurability * 0.75)}
                    optimum={ship.maxDurability}
                    value={ship.durability}
                  />
                  <span>{ship.durability}/{ship.maxDurability} <small>({pct}%)</small></span>
                </div>
              </td>
              <td>{ship.firepower}</td>
              <td>{cargoLoad(ship)}/{ship.cargoCapacity}<small>{Object.entries(ship.cargo).filter(([, qty]) => qty > 0).map(([good, qty]) => `${qty} ${goodName(good as Good, locale)}`).join(' · ') || t('Empty', '空')}</small></td>
              <td>{ship.speed}</td>
              <td>{ship.crewCapacity}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function FleetPanel({ players, state, initialPlayerId, onClose }: {
  players: Player[];
  state?: GameState;
  initialPlayerId?: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t, locale } = useT();
  const previousFocus = useRef<HTMLElement | null>(null);
  const defaultId = initialPlayerId
    ?? players.find((player) => player.id === gameController.viewerId)?.id
    ?? players.find((player) => !player.isAI)?.id
    ?? players[0].id;
  const [playerId, setPlayerId] = useState(defaultId);
  const selected = players.find((player) => player.id === playerId) ?? players[0];
  const { fleet, captains, reservedShips } = selected;
  const summary = fleetDurabilitySummary(fleet);

  const dockedGroups = state
    ? state.map
      .filter((node) => node.kind === 'island' && state.owners[node.id] === selected.id && (state.docks[node.id]?.length ?? 0) > 0)
      .map((node) => ({
        node,
        ships: state.docks[node.id],
        canRepair: colonyCanRepair(state, node.id),
      }))
    : [];
  const totalDocked = dockedGroups.reduce((sum, group) => sum + group.ships.length, 0);

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

  return createPortal(
    <dialog className="panel fleet" ref={dialog} onClose={closePanel} role="dialog" aria-modal="true" aria-labelledby="fleet-title">
      <div className="fleet-heading">
        <h2 id="fleet-title">{t('Fleet {n}/{max}', '舰队 {n}/{max}', { n: fleet.length, max: GAMEPLAY_TUNING.ships.maxFleetSize })}</h2>
        <button type="button" onClick={() => dialog.current?.close()}>{t('Close', '关闭')}</button>
      </div>
      <label>
        {t('Navigator', '航海家')}{' '}
        <select value={selected.id} onChange={(event) => setPlayerId(Number(event.target.value))}>
          {players.map((player) => (
            <option key={player.id} value={player.id}>{playerName(player, locale)} · {rankName(player.rank, locale)} ({seatTag(players, player)})</option>
          ))}
        </select>
      </label>
      {fleet.length > 0 && (
        <dl className="fleet-summary">
          <div>
            <dt>{t('Total durability', '总耐久')}</dt>
            <dd className={summary.damaged > 0 ? 'is-damaged' : undefined}>
              {summary.durability}/{summary.maxDurability} ({summary.percent}%)
              {summary.damaged > 0 && <small>{t('{n} damaged', '{n} 艘未满耐久', { n: summary.damaged })}</small>}
            </dd>
          </div>
          <div>
            <dt>{t('Total firepower', '总火力')}</dt>
            <dd>{summary.firepower}</dd>
          </div>
          <div>
            <dt>{t('Cargo', '货舱')}</dt>
            <dd>{summary.cargoUsed}/{summary.cargoCapacity}</dd>
          </div>
        </dl>
      )}
      {!!reservedShips?.length && <p>{t('{n} ships are in reserve until a colony is acquired.', '{n} 艘船暂存，获得殖民地后送往船坞。', { n: reservedShips.length })}</p>}
      <h3><StatTooltip stat="captains">{t('Captains aboard ({n}/{max})', '船上的船长（{n}/{max}）', { n: captains.length, max: GAMEPLAY_TUNING.captains.max })}</StatTooltip></h3>
      {captains.length === 0 && <p>{t('No captains recruited.', '尚未招募船长。')}</p>}
      {CAPTAINS.filter((captain) => captains.includes(captain.id)).map((captain) => <p key={captain.id}><strong>{captainName(captain.id, locale)}</strong> · {captainDescriptionText(captain.id, locale)}</p>)}
      {fleet.length > 0 ? (
        <div className="fleet-table" role="region" aria-label={t('Ship details', '船只详情')} tabIndex={0}>
          <ShipRows ships={fleet} />
        </div>
      ) : <p>{t('No ships in this fleet.', '这支舰队没有船只。')}</p>}
      {dockedGroups.length > 0 && (
        <section className="fleet-docked" aria-label={t('Docked ships', '停靠船只')}>
          <h3>{t('Docked at colonies ({n})', '停靠在殖民地（{n} 艘）', { n: totalDocked })}</h3>
          {dockedGroups.map(({ node, ships, canRepair }) => (
            <div key={node.id} className="fleet-docked-group">
              <div className="fleet-docked-heading">
                <strong>{nodeName(node, locale)}</strong>
                <span>{canRepair ? t('Repairs at turn start', '回合开始时免费修满') : t('No shipyard or repair yard', '无造船厂或修船厂')}</span>
              </div>
              <div className="fleet-table" role="region" aria-label={nodeName(node, locale)} tabIndex={0}>
                <ShipRows ships={ships} />
              </div>
            </div>
          ))}
        </section>
      )}
    </dialog>,
    document.body,
  );
}
