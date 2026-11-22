import { useState } from 'react';
import { GOODS, GOOD_VALUES, goodName, shipName, type GameState } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { gameController } from '../game/GameController';

export function BarterPanel({ state }: { state: GameState }) {
  const [error, setError] = useState('');
  const { t, locale } = useT();
  const { fleet } = state.players[state.currentPlayer];
  function accept(index: number) {
    try { gameController.acceptBarter(index); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('Barter failed', '交换失败')); }
  }
  return <section aria-labelledby="barter-title">
    <h2 id="barter-title">{t('Wind Island · Native barter', '风之岛 · 与土人交换')}</h2>
    <p>{t('Trade cheap fleet cargo for higher-value goods. Choose one offer or sail on.', '用舰队上的便宜货物换取更值钱的货物。选择一个报价，或继续航行。')}</p>
    <details className="barter-cargo">
      <summary>{t('Fleet cargo', '舰队货物')}</summary>
      <ul>
        {fleet.map((ship) => <li key={ship.id}>
          <strong>{shipName(ship.name, locale)}</strong> · {GOODS.filter((good) => (ship.cargo[good] ?? 0) > 0)
            .map((good) => `${ship.cargo[good]} ${goodName(good, locale)}`).join(' · ') || t('Empty', '空')}
        </li>)}
      </ul>
    </details>
    {error && <p role="alert">{error}</p>}
    <div className="barter-offers">
      {(state.pendingBarter ?? []).map((offer, index) => <div className="barter-offer" key={index}>
        <div className="barter-exchange">
          <p>{t('Give {q} {g} ({v}g value)', '付出 {q} 单位{g}（价值 {v} 金币）', { q: offer.giveQty, g: goodName(offer.give, locale), v: offer.giveQty * GOOD_VALUES[offer.give] })}</p>
          <span aria-hidden="true">→</span>
          <p>{t('Receive {q} {g} ({v}g value)', '换得 {q} 单位{g}（价值 {v} 金币）', { q: offer.receiveQty, g: goodName(offer.receive, locale), v: offer.receiveQty * GOOD_VALUES[offer.receive] })}</p>
        </div>
        <button className="primary" onClick={() => accept(index)}>{t('Accept offer {n}', '接受报价 {n}', { n: index + 1 })}</button>
      </div>)}
    </div>
    <button onClick={() => gameController.declineBarter()}>{t('Decline barter', '婉拒交换')}</button>
  </section>;
}
