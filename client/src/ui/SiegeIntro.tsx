import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import dialogPolyfill from 'dialog-polyfill';
import { GAMEPLAY_TUNING } from '@happy-voyage/shared';
import { useT } from '../i18n';

const SEEN_KEY = 'happy-voyage.siegeIntroSeen';

export const siegeIntroSeen = (): boolean => {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
};
const markSiegeIntroSeen = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ } };

/** Explains colony sieges once, before the player's first attack on a rival colony. */
export function SiegeIntro({ onStart, onCancel }: { onStart: () => void; onCancel: () => void }) {
  const { t } = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const started = useRef(false);
  const forts = GAMEPLAY_TUNING.combat.forts.count;

  useEffect(() => {
    const element = dialog.current!;
    if (element.open) return;
    dialogPolyfill.registerDialog(element);
    element.showModal();
  }, []);

  const close = () => { markSiegeIntroSeen(); if (started.current) onStart(); else onCancel(); };
  return createPortal(
    <dialog className="panel tutorial siege-intro" ref={dialog} onClose={close} aria-labelledby="siege-intro-title">
      <p className="tutorial-step">{t('First siege', '首次攻岛')}</p>
      <h2 id="siege-intro-title">{t('How to take a colony', '攻占殖民地的玩法')}</h2>
      <ul>
        <li>{t('The garrison defends first: ships docked at the colony, otherwise the owner\'s sailing fleet.', '先由留守舰队迎战：停靠在殖民地的船只；没有停靠船只时由所有者的航行舰队迎战。')}</li>
        <li>{t('A colony with shore forts has {n} of them. They never move, fire in every direction and fight on even after the garrison sinks or withdraws.', '建有炮台的殖民地共有 {n} 座炮台。炮台不会移动，向四周开火，留守舰队被击沉或撤退后仍会继续作战。', { n: forts })}</li>
        <li>{t('To take the colony, defeat the garrison and destroy all {n} forts. Higher fort levels mean sturdier forts with more firepower.', '必须击败留守舰队并摧毁全部 {n} 座炮台才能夺取殖民地。炮台等级越高，耐久与火力越强。', { n: forts })}</li>
        <li>{t('Retreat or losing your fleet is a defeat and costs double toll; running out of time is a draw.', '撤退或舰队全灭即战败，须缴纳双倍过路费；超时未分胜负则平局。')}</li>
        <li>{t('Own a colony? Build shore forts there to defend it.', '拥有殖民地后，可在殖民地修建炮台加强防守。')}</li>
      </ul>
      <div className="tutorial-actions">
        <button type="button" onClick={() => dialog.current?.close()}>{t('Not yet', '暂不开战')}</button>
        <button type="button" className="primary" autoFocus onClick={() => { started.current = true; dialog.current?.close(); }}>{t('Start the attack', '开始进攻')}</button>
      </div>
    </dialog>,
    document.body,
  );
}
