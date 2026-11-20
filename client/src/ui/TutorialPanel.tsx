import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TUTORIAL_STEPS } from '@happy-voyage/shared';
import dialogPolyfill from 'dialog-polyfill';

export function TutorialPanel({ onClose }: { onClose: () => void }) {
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
      <p className="tutorial-step">First voyage · {index + 1} of {TUTORIAL_STEPS.length}</p>
      <div aria-live="polite">
        <h2 id="tutorial-title">{step.title}</h2>
        <p>{step.text}</p>
      </div>
      <div className="tutorial-actions">
        <button type="button" onClick={() => dialog.current?.close()}>Skip tutorial</button>
        {index > 0 && <button type="button" onClick={() => setIndex(index - 1)}>Back</button>}
        <button type="button" className="primary" autoFocus onClick={() => last ? dialog.current?.close() : setIndex(index + 1)}>{last ? 'Set sail' : 'Next'}</button>
      </div>
    </dialog>,
    document.body,
  );
}
