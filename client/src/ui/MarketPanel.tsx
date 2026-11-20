import { useState } from 'react';
import { cargoLoad, GOODS, marketDemand, marketPrices, quoteMarketTrade, type GameState, type Good, type MarketOrder } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';

export function MarketPanel({ state }: { state: GameState }) {
  const player = state.players[state.currentPlayer];
  const initialShip = player.fleet.find((ship) => cargoLoad(ship) > 0) ?? player.fleet[0];
  const [shipId, setShipId] = useState(initialShip?.id);
  const [good, setGood] = useState<Good>(() => GOODS.find((item) => (initialShip?.cargo[item] ?? 0) > 0) ?? marketDemand(state).featuredGood);
  const [amount, setAmount] = useState('1');
  const ship = player.fleet.find((candidate) => candidate.id === shipId);
  const { stock, buy, sell } = marketPrices(state, good);
  const { featuredGood, stormRepairs } = marketDemand(state);
  const order = { good, shipId: shipId ?? -1, quantity: Number(amount) };
  const action = (side: MarketOrder['side'], label: string) => {
    const trade = { ...order, side };
    const total = quoteMarketTrade(state, trade);
    return (
      <button disabled={total === null} onClick={() => gameController.tradeAtMarket(trade)}>
        {total === null ? label : `${label} · ${total}g`}
      </button>
    );
  };

  return (
    <section className="market" aria-labelledby="market-title">
      <h2 id="market-title">Nightless Island</h2>
      <p>24-hour market · Treasury {player.gold}g</p>
      <p>In demand this round: {featuredGood}{stormRepairs && ' · Storm repairs: lumber and iron'}</p>
      <div className="market-fields">
        <label>Ship <select value={shipId ?? ''} onChange={(event) => setShipId(Number(event.target.value))}>
          {player.fleet.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select></label>
        <label>Good <select value={good} onChange={(event) => setGood(event.target.value as Good)}>
          {GOODS.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label>Quantity <input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      </div>
      <p>Market stock: {stock} · Aboard: {ship?.cargo[good] ?? 0}</p>
      <p>{ship ? `Free hold: ${ship.cargoCapacity - cargoLoad(ship)}` : 'No ships available'}</p>
      <p>Next unit: {stock > 0 ? `buy ${buy}g` : 'sold out'} · sell {sell}g</p>
      <div className="row market-orders">{action('buy', 'Buy')}{action('sell', 'Sell')}</div>
      <button className="primary" onClick={() => gameController.finishTrading()}>Done trading <kbd>D / Esc</kbd></button>
    </section>
  );
}
