import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dialogPolyfill from 'dialog-polyfill';

/** Body-level dialogs use the browser's top layer, outside the scrolling game HUD. */
export function MenuDialog({ children, className, id, label, labelledBy, suspended = false, onDismiss }: {
  children: ReactNode;
  className: string;
  id?: string;
  label?: string;
  labelledBy?: string;
  suspended?: boolean;
  onDismiss?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current!;
    dialogPolyfill.registerDialog(element);
    if (!suspended && !element.open) {
      element.showModal();
      element.focus();
    }
    // Close, rather than unmount, when another menu takes over. Island games and
    // colony forms keep their selections until the player actually leaves.
    return () => { if (element.open) element.close(); };
  }, [suspended]);

  return createPortal(
    <dialog ref={dialog} id={id} className={`menu-dialog ${className}`} tabIndex={-1}
      aria-label={label} aria-labelledby={labelledBy}
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => { event.preventDefault(); onDismiss?.(); }}>
      {children}
    </dialog>,
    document.body,
  );
}
