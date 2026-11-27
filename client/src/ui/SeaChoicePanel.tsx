import { useState } from 'react';
import { goodName, nodeName, seaEventName, type GameState } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { gameController } from '../game/GameController';

export function SeaChoicePanel({ state }: { state: GameState }) {
  const [destination, setDestination] = useState(String(state.players[state.currentPlayer].position));
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const { t, locale } = useT();
  const salvageFee = state.salvageFee;
  const canAffordSalvage = salvageFee !== null && state.players[state.currentPlayer].gold >= salvageFee;
  const act = (action: () => void) => {
    try { action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('Sea encounter failed', '海上遭遇失败')); }
  };
  return <section className="sea-choice" aria-labelledby="sea-choice-title">
    {state.phase === 'awaitingMerchant' && state.pendingMerchant && <>
      <h2 id="sea-choice-title">¤ {t('Merchant ship · Premium trade', '海上商船 · 高价收购')}</h2>
      {state.pendingMerchant.quantity > 0 && <>
        <p>{t('Sell {q} {g} from your fleet for {gold}g?', '以 {gold} 金币卖出舰队上的 {q} 单位{g}？', { q: state.pendingMerchant.quantity, g: goodName(state.pendingMerchant.good, locale), gold: state.pendingMerchant.gold })}</p>
        <button className="primary" onClick={() => act(() => gameController.acceptMerchant())}>{t('Accept merchant offer', '接受商船报价')}</button>
      </>}
      {state.pendingMerchant.stock && state.pendingMerchant.stock.quantity > 0 && <>
        <p>{t('Buy {g}: {gold}g each ({q} available).', '买入{g}：每单位 {gold} 金币（{q} 单位）。', { g: goodName(state.pendingMerchant.stock.good, locale), gold: state.pendingMerchant.stock.unitPrice, q: state.pendingMerchant.stock.quantity })}</p>
        <label>{t('Quantity', '数量')} <input type="number" min="1" max={state.pendingMerchant.stock.quantity} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></label>
        <button onClick={() => act(() => gameController.buyMerchant(quantity))}>{t('Buy cargo', '买入货物')}</button>
      </>}
      <button onClick={() => gameController.declineMerchant()}>{t('Leave merchant ship', '离开商船')}</button>
    </>}
    {state.phase === 'awaitingSalvage' && salvageFee !== null && <>
      <h2 id="sea-choice-title">⚓ {t('Wreck salvage', '沉船打捞')}</h2>
      <p>{t('Pay {fee}g to recover a random amount of gold. You might recover less than you spend.', '支付 {fee} 金币打捞随机数量的金币，有可能收不回费用。', { fee: salvageFee })}</p>
      {!canAffordSalvage && <p>{t('Not enough gold to pay the fee.', '金币不足，无法支付费用。')}</p>}
      <button className="primary" disabled={!canAffordSalvage} onClick={() => act(() => gameController.salvageWreck())}>{t('Pay {fee}g and salvage', '支付 {fee} 金币打捞', { fee: salvageFee })}</button>
      <button onClick={() => gameController.skipSalvage()}>{t('Skip salvage', '跳过打捞')}</button>
    </>}
    {state.phase === 'awaitingWyvern' && <>
      <h2 id="sea-choice-title">W {t('Wyvern · Choose your destination', '翼龙 · 选择目的地')}</h2>
      <p>{t('Fly to any stop. Its landing effect will resolve when you arrive.', '飞往任意地点。抵达时会结算该地的停靠效果。')}</p>
      <label htmlFor="wyvern-destination">{t('Destination', '目的地')}</label>{' '}
      <select id="wyvern-destination" value={destination} onChange={(e) => setDestination(e.target.value)}>
        {state.map.map((node) => <option key={node.id} value={node.id}>{node.id + 1}. {nodeName(node, locale)}{node.event === 'treasure' ? '' : locale === 'en' ? ` · ${node.event ?? node.special ?? node.kind}` : node.event ? ` · ${seaEventName(node.event, locale)}` : ''}</option>)}
      </select>
      <button className="primary" onClick={() => act(() => gameController.wyvernFly(Number(destination)))}>{t('Fly with wyvern', '乘翼龙飞行')}</button>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
