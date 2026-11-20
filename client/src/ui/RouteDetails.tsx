import type { GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';

/** A readable key for the chart when the canvas labels are too small. */
export function RouteDetails({ state }: { state: GameState }) {
  return (
    <details className="panel route-details">
      <summary>Route details</summary>
      <ol className="route-stops">
        {state.map.map((stop) => {
          const owner = state.owners[stop.id];
          const fleets = state.players.filter((player) => !player.bankrupt && gameController.shownPosition(player) === stop.id);
          return (
            <li key={stop.id}>
              <strong>{stop.name}</strong>
              {stop.kind === 'special' && <div>{stop.chineseName} · Special island</div>}
              {stop.kind === 'port' && <div>{stop.nation} home port · {state.players.find((player) => player.homePort === stop.id)?.name ?? 'Crown'}</div>}
              {stop.kind === 'event' && <div>Sea encounter</div>}
              {stop.kind === 'island' && (
                <div>{stop.price}g · toll {stop.toll}g{owner !== null && ` · Colony of ${state.players[owner].name}`}</div>
              )}
              {fleets.length > 0 && <div>Fleets: {fleets.map((player) => player.name).join(', ')}</div>}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
