import { BUILDINGS, buildingLevel, nextBuildingCost, colonyToll, colonyValue, colonyDefenders, COMBAT, forecastColonyBattle, tollDue, SHIP_RECIPES, SHIP_TYPES, USED_SHIP_PRICES, USED_SHIP_CONDITION, shipSalePrice, type BuildingKind, type GameState, type ShipType } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { ColonyGoods } from './ColonyGoods';
import { Compass } from './Compass';
import { ShortcutLegend } from './ShortcutLegend';
import { useState } from 'react';
import { BarterPanel } from './BarterPanel';
import { TransferPanel } from './TransferPanel';
import { MarketPanel } from './MarketPanel';
import { STRATEGIES } from '@happy-voyage/shared';

const BUILDING_SIZES = ['None', 'Small', 'Medium', 'Large'];

/** What the human can do right now: spin, claim or decline, or start over. */
export function ActionPanel({ state }: { state: GameState }) {
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [destination, setDestination] = useState(state.map[0].id);
  const player = state.players[state.currentPlayer];
  const spinning = state.phase === 'spinning';
  const trading = state.phase === 'awaitingCargoMarket' && !player.isAI;
  const spinId = gameController.spinId;
  const summary = !player.isAI && state.phase === 'awaitingSpin' ? gameController.feedback.summary : null;
  const gold = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value)}g`;
  const headline = gameController.headline;

  let body;
  if (state.phase === 'gameOver') {
    const winner = state.players[state.winner!];
    body = (
      <>
        <h2>{winner.isAI ? `${winner.name} wins the seas.` : 'Victory! The crown celebrates you.'}</h2>
        <p>{state.log[state.log.length - 1]}</p>
        <table className="standings">
          <caption>Final standings · winner first, then afloat navigators by net worth</caption>
          <thead><tr><th>Navigator</th><th>Gold</th><th>Islands</th><th>Net worth</th><th>Status</th></tr></thead>
          <tbody>{state.players.map((p) => ({
            ...p,
            islands: gameController.islandsOwnedBy(p.id),
            worth: gameController.netWorth(p.id),
          })).sort((a, b) => Number(b.id === state.winner) - Number(a.id === state.winner)
            || Number(a.bankrupt) - Number(b.bankrupt) || b.worth - a.worth || a.id - b.id).map((p) => (
            <tr key={p.id}><th>{p.name}{!p.isAI && ' (You)'}</th><td>{p.gold}g</td><td>{p.islands}</td><td>{p.worth}g</td><td>{p.bankrupt ? 'Bankrupt' : p.id === state.winner ? 'Winner' : 'Afloat'}</td></tr>
          ))}</tbody>
        </table>
        <button className="primary" onClick={() => gameController.quit()}>
          New voyage <kbd>Enter / Space</kbd>
        </button>
      </>
    );
  } else if (spinning) {
    body = <p className="waiting">{player.isAI ? `${player.name} spins the compass.` : 'Your compass is spinning.'}</p>;
  } else if (player.isAI) {
    body = <p className="waiting">{player.name} is at the helm…</p>;
  } else if (state.phase === 'awaitingSpin') {
    body = (
      <>
        <p>Your turn, {player.name}.</p>
        <button className="primary big" onClick={() => gameController.spinCompass()}>
          Spin compass <kbd>Space / Enter</kbd>
        </button>
      </>
    );
  } else if (trading) {
    body = <MarketPanel key={player.id} state={state} />;
  } else if (state.phase === 'awaitingMarket') {
    body = <>
      <h2>Skeleton Island ship market</h2>
      <p>Treasury {player.gold}g · Second-hand ships have {USED_SHIP_CONDITION * 100}% durability.</p>
      <h3>Pirate stock</h3>
      {state.marketStock.length === 0 && <p>Sold out. New stock arrives next visit.</p>}
      {state.marketStock.map((type) => <div className="building-option" key={type}>
        <strong>{SHIP_TYPES[type].label}</strong> · {Math.floor(SHIP_TYPES[type].maxDurability * USED_SHIP_CONDITION)}/{SHIP_TYPES[type].maxDurability} durability
        <button disabled={!gameController.canBuyUsedShip(type)} onClick={() => gameController.buyUsedShip(type)}>Buy {SHIP_TYPES[type].label} ({USED_SHIP_PRICES[type]}g)</button>
      </div>)}
      <h3>Your fleet</h3>
      <p>Keep at least one ship. Only empty ships can be sold; unload cargo at a colony first. Sales are final.</p>
      {player.fleet.map((ship) => <div className="building-option" key={ship.id}>
        <strong>{ship.name}</strong> · {ship.durability}/{ship.maxDurability} durability
        <button disabled={!gameController.canSellShip(ship.id)} onClick={() => gameController.sellShip(ship.id)}>Sell {ship.name} ({shipSalePrice(ship)}g)</button>
      </div>)}
      <button className="primary" onClick={() => gameController.finishMarket()}>Sail on</button>
    </>;
  } else if (state.phase === 'awaitingBuild') {
    const nodeId = player.position;
    const yardLevel = buildingLevel(state, nodeId, 'shipyard');
    body = (
      <>
        <h2>Build at {state.map[nodeId].name}</h2>
        <p>Your colony · Toll {colonyToll(state, nodeId)}g · Treasury {player.gold}g</p>
        <ColonyGoods state={state} nodeId={nodeId} />
        <button onClick={() => setTransfersOpen(true)}>Transfers</button>
        {(Object.keys(BUILDINGS) as BuildingKind[]).map((kind) => {
          const building = BUILDINGS[kind];
          const level = buildingLevel(state, nodeId, kind);
          const cost = nextBuildingCost(state, nodeId, kind);
          return (
            <div className="building-option" key={kind}>
              <div><strong>{building.label}</strong> · {building.chineseName} · {BUILDING_SIZES[level]}</div>
              <small>{building.description}</small>
              <button disabled={!gameController.canBuild(kind)} onClick={() => gameController.build(kind)}>
                {cost === null ? 'Max level' : `${level ? 'Upgrade' : 'Build'} (${cost}g)`}
              </button>
            </div>
          );
        })}
        <section aria-labelledby="shipbuilding-heading">
          <h3 id="shipbuilding-heading">Shipbuilding</h3>
          {yardLevel === 0 ? <p>Build a shipyard to launch ships.</p> :
            (Object.keys(SHIP_RECIPES) as ShipType[]).map((type) => {
              const recipe = SHIP_RECIPES[type];
              const ship = SHIP_TYPES[type];
              const canBuild = gameController.canBuildShip(type);
              return (
                <div className="building-option" key={type}>
                  <div><strong>{ship.label}</strong> · {recipe.lumber} lumber · {recipe.iron} iron</div>
                  {!canBuild && <small>{yardLevel < recipe.yardLevel
                    ? `Requires a ${BUILDING_SIZES[recipe.yardLevel].toLowerCase()} shipyard.`
                    : 'Not enough materials.'}</small>}
                  <button disabled={!canBuild} onClick={() => gameController.buildShip(type)}>
                    Build {ship.label}
                  </button>
                </div>
              );
            })}
        </section>
        <button className="primary" onClick={() => gameController.finishBuilding()}>Done <kbd>D / Esc</kbd></button>
      </>
    );
  } else if (state.phase === 'awaitingToll') {
    const island = state.map[player.position];
    const { ships: defenders, owner, fromFleet } = colonyDefenders(state, island.id);
    const firepower = (ships: { firepower: number }[]) => ships.reduce((sum, ship) => sum + ship.firepower, 0);
    const hull = (ships: { durability: number }[]) => ships.reduce((sum, ship) => sum + ship.durability, 0);
    const forecast = { victory: 'likely victory', defeat: 'likely defeat', draw: 'likely draw' }[forecastColonyBattle(state, player)];
    body = (
      <>
        <h2>{owner.name}'s colony at {island.name}</h2>
        <p>Pay <strong>{tollDue(state, player, island.id)}g</strong> toll, or open fire on {fromFleet ? `${owner.name}'s fleet` : 'the docked ships'}?</p>
        <p>
          Your fleet: {player.fleet.length} ships · {firepower(player.fleet)} firepower · {hull(player.fleet)} durability.<br />
          Defenders: {defenders.length} ships · {firepower(defenders)} firepower · {hull(defenders)} durability ({forecast}).
        </p>
        <p>
          Sink every defender within {COMBAT.rounds} volleys to take the colony. Lose every ship and you pay {tollDue(state, player, island.id, COMBAT.defeatTollMultiplier)}g double toll; otherwise both fleets sail home.
        </p>
        <div className="row">
          <button className="primary" onClick={() => gameController.payToll()}>Pay toll <kbd>P</kbd></button>
          <button onClick={() => gameController.fight()}>Fight <kbd>F</kbd></button>
        </div>
      </>
    );
  } else if (state.phase === 'awaitingBarter') {
    body = <BarterPanel state={state} />;
  } else if (state.phase === 'awaitingClaim') {
    const island = state.map[state.pendingClaim!];
    body = (
      <>
        <h2>{island.name}</h2>
        <p>
          Uncharted land rich in <strong>{island.specialty}</strong>. Found a colony for <strong>{island.price}g</strong>?
          Rivals landing here must pay you {island.toll}g or attack your ships.
        </p>
        <p>
          Claiming leaves you {player.gold - island.price!}g in cash. This colony adds {colonyValue(island)}g to your final score.
        </p>
        <div className="row">
          <button className="primary" onClick={() => gameController.claim()}>
            Claim ({island.price}g) <kbd>C</kbd>
          </button>
          <button onClick={() => gameController.decline()}>Sail on <kbd>S / Esc</kbd></button>
        </div>
      </>
    );
  } else {
    body = <p className="waiting">Sailing…</p>;
  }

  return (
    <div className="panel actions">
      {!player.isAI && state.phase !== 'gameOver' && <section aria-label="Strategy cards" style={{ fontFamily: "'Sea Names', sans-serif" }}>
        <h3>Strategy cards ({player.strategies.length}/5)</h3>
        {player.strategies.length === 0 && <p>No strategy cards.</p>}
        {player.strategies.includes('navigate') && <label>Navigate destination <select value={destination} onChange={(e) => setDestination(Number(e.target.value))}>
          {state.map.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
        </select></label>}
        {player.strategies.map((id, index) => <div key={`${id}-${index}`}>
          <strong>{STRATEGIES[id].name} · {STRATEGIES[id].chineseName}</strong>
          <p>{STRATEGIES[id].description}</p>
          <button disabled={!gameController.canUseStrategy(id, id === 'navigate' ? destination : undefined)} onClick={() => gameController.useStrategy(id, id === 'navigate' ? destination : undefined)}>Use {STRATEGIES[id].name}</button>
        </div>)}
        {player.knownHoard !== null && <p>Buried hoard: {state.map[player.knownHoard].name}</p>}
      </section>}
      <p>{state.players.filter((p) => p.id !== player.id).map((p) => `${p.name}: ${p.strategies.length} cards`).join(' · ')}</p>
      {state.phase === 'gameOver' || trading ? body : (
        <div className="action-content">
          <Compass
            spinId={spinId}
            result={state.lastSpin}
            spinning={spinning}
            duration={gameController.timings.spin}
            onSettled={() => gameController.finishSpin(spinId)}
          />
          <div>{body}</div>
        </div>
      )}
      {gameController.waiting && (
        <button onClick={() => gameController.skipToMyTurn()}>Skip to my turn <kbd>K</kbd></button>
      )}
      {summary && (
        <div className="turn-summary">
          <strong>Since your last turn</strong>
          {summary.tolls.map((toll, i) => (
            <div key={i} className={toll.direction === 'received' ? 'income' : 'expense'}>
              Toll {toll.direction}: {gold(toll.direction === 'received' ? toll.amount : -toll.amount)} {toll.direction === 'received' ? 'from' : 'to'} {toll.name}
            </div>
          ))}
          {summary.claims.map((claim, i) => <div key={i}>{claim.name} {claim.captured ? `sank your defenders and captured ${claim.island}` : `claimed ${claim.island}`}.</div>)}
          <div>Net gold: <strong className={summary.netGold < 0 ? 'expense' : 'income'}>{gold(summary.netGold)}</strong></div>
        </div>
      )}
      <div role="status">
        {headline && (!summary || headline.royal) && state.phase !== 'gameOver' && <div className={`headline ${headline.tone}`}>{headline.text}</div>}
      </div>
      <ShortcutLegend />
      {transfersOpen && state.phase === 'awaitingBuild' && !player.isAI && (
        <TransferPanel state={state} onClose={() => setTransfersOpen(false)} />
      )}
    </div>
  );
}
