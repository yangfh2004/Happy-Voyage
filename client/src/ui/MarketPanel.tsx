import { useState } from 'react';
import { cargoLoad, GOODS, goodName, shipName, marketDemand, marketPrices, quoteMarketTrade, type GameState, type Good, type MarketOrder } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { useT } from '../i18n';
import { StatTooltip } from './StatTooltip';

export function MarketPanel({ state }: { state: GameState }) {
  const player = state.players[state.currentPlayer];
  const { t, locale } = useT();
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
        {total === null ? label : `${label} · ${total}${t('g', ' 金币')}`}
      </button>
    );
  };

  return (
    <section className="market" aria-labelledby="market-title">
      <h2 id="market-title">{t('24-hour market', '24 小时市场')}</h2>
      <div className="nightless-ticker">
        <StatTooltip stat="gold">{t('Treasury {g}g', '金库 {g} 金币', { g: player.gold })}</StatTooltip>
        <span>{t('In demand this round: {g}', '本回合热门：{g}', { g: goodName(featuredGood, locale) })}{stormRepairs && t(' · Storm repairs: lumber and iron', ' · 风暴修理：木材和铁矿')}</span>
      </div>
      <div className="nightless-counter">
        <div className="market-fields">
          <label>{t('Ship', '船只')} <select value={shipId ?? ''} onChange={(event) => setShipId(Number(event.target.value))}>
            {player.fleet.map((candidate) => <option key={candidate.id} value={candidate.id}>{shipName(candidate.name, locale)}</option>)}
          </select></label>
          <label>{t('Good', '货物')} <select value={good} onChange={(event) => setGood(event.target.value as Good)}>
            {GOODS.map((item) => <option key={item} value={item}>{goodName(item, locale)}</option>)}
          </select></label>
          <label>{t('Quantity', '数量')} <input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        </div>
        <div className="nightless-quote" aria-live="polite">
          <p><StatTooltip stat="marketStock">{t('Market stock: {s} · Aboard: {a}', '市场库存：{s} · 船上：{a}', { s: stock, a: ship?.cargo[good] ?? 0 })}</StatTooltip></p>
          <p>{ship ? <StatTooltip stat="freeHold">{t('Free hold: {n}', '剩余舱位：{n}', { n: ship.cargoCapacity - cargoLoad(ship) })}</StatTooltip> : t('No ships available', '没有可用的船只')}</p>
          <p><StatTooltip stat="marketPrice">{t('Next unit:', '下一单位：')} {stock > 0 ? t('buy {g}g', '买入 {g} 金币', { g: buy }) : t('sold out', '已售罄')} · {t('sell {g}g', '卖出 {g} 金币', { g: sell })}</StatTooltip></p>
        </div>
        <div className="nightless-orders">{action('buy', t('Buy', '买入'))}{action('sell', t('Sell', '卖出'))}</div>
      </div>
      <button className="primary" onClick={() => gameController.finishTrading()}>{t('Done trading', '完成交易')} <kbd>D / Esc</kbd></button>
    </section>
  );
}
