import { useState } from 'react';
import { GOOD_VALUES, goodName, type GameState } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { gameController } from '../game/GameController';

export function BarterPanel({ state }: { state: GameState }) {
  const [error, setError] = useState('');
  const { t, locale } = useT();
  function accept(index: number) {
    try { gameController.acceptBarter(index); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('Barter failed', '交换失败')); }
  }
  return <section aria-labelledby="barter-title">
    <h2 id="barter-title">{t('Wind Island · Native barter', '风之岛 · 与土人交换')}</h2>
    <p>{t('Trade cheap fleet cargo for higher-value goods. Choose one offer or sail on.', '用舰队上的便宜货物换取更值钱的货物。选择一个报价，或继续航行。')}</p>
    {error && <p role="alert">{error}</p>}
    {(state.pendingBarter ?? []).map((offer, index) => <div className="building-option" key={index}>
      <p>{t('Give {q} {g} ({v}g value)', '付出 {q} 单位{g}（价值 {v} 金币）', { q: offer.giveQty, g: goodName(offer.give, locale), v: offer.giveQty * GOOD_VALUES[offer.give] })}</p>
      <p>{t('Receive {q} {g} ({v}g value)', '换得 {q} 单位{g}（价值 {v} 金币）', { q: offer.receiveQty, g: goodName(offer.receive, locale), v: offer.receiveQty * GOOD_VALUES[offer.receive] })}</p>
      <button className="primary" onClick={() => accept(index)}>{t('Accept offer {n}', '接受报价 {n}', { n: index + 1 })}</button>
    </div>)}
    <button onClick={() => gameController.declineBarter()}>{t('Decline barter', '婉拒交换')}</button>
  </section>;
}
