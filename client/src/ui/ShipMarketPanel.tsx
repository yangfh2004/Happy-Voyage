import { SHIP_TYPES, USED_SHIP_CONDITION, USED_SHIP_PRICES, shipName, shipSalePrice, shipTypeName, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { useT } from '../i18n';
import { StatTooltip } from './StatTooltip';

export function ShipMarketPanel({ state }: { state: GameState }) {
  const { t, locale } = useT();
  const player = state.players[state.currentPlayer];
  return (
    <section aria-labelledby="ship-market-title">
      <h2 id="ship-market-title">{t('Skeleton Island ship market', '骷髅岛船只市场')}</h2>
      <p><StatTooltip stat="gold">{t('Treasury {g}g', '金库 {g} 金币', { g: player.gold })}</StatTooltip> · {t('Second-hand ships have', '二手船只有')} <StatTooltip stat="durability">{t('{d}% durability', '{d}% 耐久', { d: USED_SHIP_CONDITION * 100 })}</StatTooltip>{t('.', '。')}</p>
      <div className="ship-market-ledger">
        <section aria-labelledby="ship-market-stock">
          <h3 id="ship-market-stock">{t('Pirate stock', '海盗库存')}</h3>
          {state.marketStock.length === 0 && <p>{t('Sold out. New stock arrives next visit.', '已售罄。下次造访时会有新货。')}</p>}
          {state.marketStock.map((type) => <div className="ship-market-entry" key={type}>
            <strong>{shipTypeName(type, locale)}</strong>
            <div><StatTooltip stat="durability">{Math.floor(SHIP_TYPES[type].maxDurability * USED_SHIP_CONDITION)}/{SHIP_TYPES[type].maxDurability} {t('durability', '耐久')}</StatTooltip></div>
            <button disabled={!gameController.canBuyUsedShip(type)} onClick={() => gameController.buyUsedShip(type)}>{t('Buy {s} ({g}g)', '购买{s}（{g} 金币）', { s: shipTypeName(type, locale), g: USED_SHIP_PRICES[type] })}</button>
          </div>)}
        </section>
        <section aria-labelledby="ship-market-fleet">
          <h3 id="ship-market-fleet">{t('Your fleet', '你的舰队')}</h3>
          <p>{t('Keep at least one ship. Only empty ships can be sold; unload cargo at a colony first. Sales are final.', '至少保留一艘船。只能出售空船，请先在殖民地卸货。出售后不可撤销。')}</p>
          {player.fleet.map((ship) => <div className="ship-market-entry" key={ship.id}>
            <strong>{shipName(ship.name, locale)}</strong>
            <div><StatTooltip stat="durability">{ship.durability}/{ship.maxDurability} {t('durability', '耐久')}</StatTooltip></div>
            <button disabled={!gameController.canSellShip(ship.id)} onClick={() => gameController.sellShip(ship.id)}>{t('Sell {s} ({g}g)', '出售{s}（{g} 金币）', { s: shipName(ship.name, locale), g: shipSalePrice(ship) })}</button>
          </div>)}
        </section>
      </div>
      <button className="primary" onClick={() => gameController.finishMarket()}>{t('Sail on', '继续航行')}</button>
    </section>
  );
}
