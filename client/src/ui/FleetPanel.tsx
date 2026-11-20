import { useEffect, useRef, useState } from 'react';
import { SHIP_TYPES, type Player } from '@happy-voyage/shared';

export function FleetPanel({ players, onClose }: { players: Player[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [playerId, setPlayerId] = useState((players.find((player) => !player.isAI) ?? players[0]).id);
  const { fleet } = players.find((player) => player.id === playerId) ?? players[0];

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog className="panel fleet" ref={dialog} onClose={onClose} aria-labelledby="fleet-title">
      <div className="fleet-heading">
        <h2 id="fleet-title">Fleet</h2>
        <form method="dialog"><button>Close</button></form>
      </div>
      <label>
        Navigator{' '}
        <select value={playerId} onChange={(event) => setPlayerId(Number(event.target.value))}>
          {players.map((player) => (
            <option key={player.id} value={player.id}>{player.name} ({player.isAI ? 'AI' : 'You'})</option>
          ))}
        </select>
      </label>
      {fleet.length > 0 ? (
        <div className="fleet-table" role="region" aria-label="Ship details" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Ship</th>
                <th scope="col">Durability</th>
                <th scope="col">Firepower</th>
                <th scope="col">Cargo capacity</th>
                <th scope="col">Speed</th>
                <th scope="col">Crew capacity</th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((ship) => (
                <tr key={ship.id}>
                  <th scope="row">{ship.name}<small>{SHIP_TYPES[ship.type].label}</small></th>
                  <td>{ship.durability}/{ship.maxDurability}</td>
                  <td>{ship.firepower}</td>
                  <td>{ship.cargoCapacity}</td>
                  <td>{ship.speed}</td>
                  <td>{ship.crewCapacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>No ships in this fleet.</p>}
    </dialog>
  );
}
