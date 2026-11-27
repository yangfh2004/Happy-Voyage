import { useState } from 'react';
import { cargoLoad, colonyMarket, GOODS, goodName, marketTradeQuote, shipName, type GameState, type Good, type MarketOrder } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { useT } from '../i18n';

export function ColonyMarketPanel({ state }: { state: GameState }) {
  const { t, locale } = useT();
  const player = state.players[state.currentPlayer];
  const [shipId, setShipId] = useState(() => player.fleet.find((ship) =>
    GOODS.some((good) => good !== 'lumber' && good !== 'iron' && (ship.cargo[good] ?? 0) > 0))?.id);
  const [selectedGood, setSelectedGood] = useState<Good>();
  const [amount, setAmount] = useState('1');
  const local = colonyMarket(state);
  if (!local) return null;
  const ship = player.fleet.find((candidate) => candidate.id === shipId) ?? player.fleet[0];
  const specialty = local.node.specialty;
  const goods = GOODS.filter((good) => good !== 'lumber' && good !== 'iron' && (good === specialty || (ship?.cargo[good] ?? 0) > 0));
  const good = selectedGood && goods.includes(selectedGood) ? selectedGood : specialty ?? goods[0];
  const action = (side: MarketOrder['side'], label: string) => {
    if (!good || !ship) return <button disabled>{label}</button>;
    const order = { side, good, shipId: ship.id, quantity: Number(amount) };
    const quote = marketTradeQuote(state, order);
    return <button disabled={!quote} onClick={() => gameController.tradeAtMarket(order)}>
      {quote ? t('{label} · {g}g', '{label} · {g} 金币', { label, g: quote.total }) : label}
      {quote && quote.tax > 0 && t(' ({tax}g tax)', '（税 {tax} 金币）', { tax: quote.tax })}
    </button>;
  };

  return (
    <details className="colony-market">
      <summary>{t('Local market', '本地市场')}</summary>
      <p>{t('Buy this island’s specialty or sell specialties from your fleet. The market uses its own stock, not the collection field.',
        '购买岛上特产，或出售舰队携带的特产。市场库存与采集场分开。')}</p>
      <p>{local.owner === player.id ? t('No trade tax for the colony owner.', '岛主交易免税。') :
        t('{rate} trade tax goes to the colony owner. Landing toll is separate.', '交易税率为 {rate}，税金归岛主。过路费另计。', {
          rate: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 3 }).format(local.taxRate),
        })}</p>
      <p>{t('Treasury {g}g', '金库 {g} 金币', { g: player.gold })} · {specialty
        ? t('Local stock: {n} {good}', '市场库存：{n} 单位{good}', { n: local.stock, good: goodName(specialty, locale) })
        : t('No local specialty for sale.', '无当地特产出售。')}</p>
      <div className="market-fields">
        <label>{t('Ship', '船只')} <select value={ship?.id ?? ''} onChange={(event) => setShipId(Number(event.target.value))}>
          {player.fleet.map((candidate) => <option key={candidate.id} value={candidate.id}>{shipName(candidate.name, locale)}</option>)}
        </select></label>
        <label>{t('Specialty', '特产')} <select value={good ?? ''} disabled={!goods.length} onChange={(event) => setSelectedGood(event.target.value as Good)}>
          {!goods.length && <option value="">{t('None', '无')}</option>}
          {goods.map((item) => <option key={item} value={item}>{goodName(item, locale)}</option>)}
        </select></label>
        <label>{t('Quantity', '数量')} <input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      </div>
      {ship && <p>{t('Aboard: {a} · Free hold: {n}', '船上：{a} · 剩余舱位：{n}', {
        a: good ? ship.cargo[good] ?? 0 : 0, n: ship.cargoCapacity - cargoLoad(ship),
      })}</p>}
      <div className="colony-market-orders">{action('buy', t('Buy', '买入'))}{action('sell', t('Sell', '卖出'))}</div>
    </details>
  );
}
