import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TUTORIAL_STEPS } from '@happy-voyage/shared';
import dialogPolyfill from 'dialog-polyfill';
import { useT } from '../i18n';

export function TutorialPanel({ onClose }: { onClose: () => void }) {
  const { t, l } = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const step = TUTORIAL_STEPS[index];
  const last = index === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    const element = dialog.current!;
    if (element.open) return;
    dialogPolyfill.registerDialog(element);
    element.showModal();
  }, []);

  return createPortal(
    <dialog className="panel tutorial" ref={dialog} onClose={onClose} aria-labelledby="tutorial-title">
      <p className="tutorial-step">{t('First voyage · {step} of {total}', '初次航行 · 第 {step} 步，共 {total} 步', { step: index + 1, total: TUTORIAL_STEPS.length })}</p>
      <div aria-live="polite">
        <h2 id="tutorial-title">{l(step.title)}</h2>
        <p>{l(step.text)}</p>
      </div>
      <div className="tutorial-actions">
        <button type="button" onClick={() => dialog.current?.close()}>{t('Skip tutorial', '跳过教程')}</button>
        {index > 0 && <button type="button" onClick={() => setIndex(index - 1)}>{t('Back', '上一步')}</button>}
        <button type="button" className="primary" autoFocus onClick={() => last ? dialog.current?.close() : setIndex(index + 1)}>{last ? t('Set sail', '启航') : t('Next', '下一步')}</button>
      </div>
    </dialog>,
    document.body,
  );
}
