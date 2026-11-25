import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CAPTAINS, GAMEPLAY_TUNING, captainDescriptionText, captainName, cargoLoad, goodName, playerName, rankName, shipName, shipTypeName, type Good, type Player } from '@happy-voyage/shared';
import { useT } from '../i18n';
import dialogPolyfill from 'dialog-polyfill';
import { gameController } from '../game/GameController';
import { seatTag } from './seats';
import { StatTooltip } from './StatTooltip';

export function FleetPanel({ players, onClose }: { players: Player[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t, locale } = useT();
  const previousFocus = useRef<HTMLElement | null>(null);
  const [playerId, setPlayerId] = useState((players.find((player) => player.id === gameController.viewerId) ?? players.find((player) => !player.isAI) ?? players[0]).id);
  const { fleet, captains, reservedShips } = players.find((player) => player.id === playerId) ?? players[0];

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
        <select value={playerId} onChange={(event) => setPlayerId(Number(event.target.value))}>
          {players.map((player) => (
            <option key={player.id} value={player.id}>{playerName(player, locale)} · {rankName(player.rank, locale)} ({seatTag(players, player)})</option>
          ))}
        </select>
      </label>
      {!!reservedShips?.length && <p>{t('{n} ships are in reserve until a colony is acquired.', '{n} 艘船暂存，获得殖民地后送往船坞。', { n: reservedShips.length })}</p>}
      <h3><StatTooltip stat="captains">{t('Captains aboard ({n}/{max})', '船上的船长（{n}/{max}）', { n: captains.length, max: GAMEPLAY_TUNING.captains.max })}</StatTooltip></h3>
      {captains.length === 0 && <p>{t('No captains recruited.', '尚未招募船长。')}</p>}
      {CAPTAINS.filter((captain) => captains.includes(captain.id)).map((captain) => <p key={captain.id}><strong>{captainName(captain.id, locale)}</strong> · {captainDescriptionText(captain.id, locale)}</p>)}
      {fleet.length > 0 ? (
        <div className="fleet-table" role="region" aria-label={t('Ship details', '船只详情')} tabIndex={0}>
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
              {fleet.map((ship) => (
                <tr key={ship.id}>
                  <th scope="row">{ship.signature && <span aria-label={t('Signature ship', '特色船只')} title={t('Signature ship', '特色船只')}>★ </span>}{shipName(ship.name, locale)}<small>{shipTypeName(ship.type, locale)}{ship.signature && t(' · signature ship', ' · 特色船只')}</small></th>
                  <td>{ship.durability}/{ship.maxDurability}</td>
                  <td>{ship.firepower}</td>
                  <td>{cargoLoad(ship)}/{ship.cargoCapacity}<small>{Object.entries(ship.cargo).filter(([, qty]) => qty > 0).map(([good, qty]) => `${qty} ${goodName(good as Good, locale)}`).join(' · ') || t('Empty', '空')}</small></td>
                  <td>{ship.speed}</td>
                  <td>{ship.crewCapacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>{t('No ships in this fleet.', '这支舰队没有船只。')}</p>}
    </dialog>,
    document.body,
  );
}
