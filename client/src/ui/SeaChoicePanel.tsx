import { useState } from 'react';
import { goodName, nodeName, seaEventName, type GameState } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { gameController } from '../game/GameController';

export function SeaChoicePanel({ state }: { state: GameState }) {
  const [destination, setDestination] = useState(String(state.players[state.currentPlayer].position));
  const [error, setError] = useState('');
  const { t, locale } = useT();
  const act = (action: () => void) => {
    try { action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('Sea encounter failed', '海上遭遇失败')); }
  };
  return <section className="sea-choice" aria-labelledby="sea-choice-title">
    {state.phase === 'awaitingMerchant' && state.pendingMerchant && <>
      <h2 id="sea-choice-title">¤ {t('Merchant ship · Premium trade', '海上商船 · 高价收购')}</h2>
      <p>{t('Sell {q} {g} from your fleet for {gold}g?', '以 {gold} 金币卖出舰队上的 {q} 单位{g}？', { q: state.pendingMerchant.quantity, g: goodName(state.pendingMerchant.good, locale), gold: state.pendingMerchant.gold })}</p>
      <button className="primary" onClick={() => act(() => gameController.acceptMerchant())}>{t('Accept merchant offer', '接受商船报价')}</button>
      <button onClick={() => gameController.declineMerchant()}>{t('Decline merchant offer', '拒绝商船报价')}</button>
    </>}
    {state.phase === 'awaitingWyvern' && <>
      <h2 id="sea-choice-title">W {t('Wyvern · Choose your destination', '翼龙 · 选择目的地')}</h2>
      <p>{t('Fly to any stop. Its landing effect will resolve when you arrive.', '飞往任意地点。抵达时会结算该地的停靠效果。')}</p>
      <label htmlFor="wyvern-destination">{t('Destination', '目的地')}</label>{' '}
      <select id="wyvern-destination" value={destination} onChange={(e) => setDestination(e.target.value)}>
        {state.map.map((node) => <option key={node.id} value={node.id}>{node.id + 1}. {nodeName(node, locale)}{locale === 'en' ? ` · ${node.event ?? node.special ?? node.kind}` : node.event ? ` · ${seaEventName(node.event, locale)}` : ''}</option>)}
      </select>
      <button className="primary" onClick={() => act(() => gameController.wyvernFly(Number(destination)))}>{t('Fly with wyvern', '乘翼龙飞行')}</button>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
