import { useLayoutEffect, useRef, type ReactNode } from 'react';
import dialogPolyfill from 'dialog-polyfill';
import type { GameState, SpecialKind } from '@happy-voyage/shared';
import './IslandWindow.css';

const activityIsland: Partial<Record<GameState['phase'], SpecialKind>> = {
  awaitingLottery: 'treasure',
};

export function islandWindowFor(state: GameState, canHelm: boolean): SpecialKind | null {
  const player = state.players[state.currentPlayer];
  if (!canHelm || player.isAI) return null;
  const island = activityIsland[state.phase];
  return island && state.map[player.position]?.special === island ? island : null;
}

export function IslandWindow({ island, label, titleId, children }: {
  island: SpecialKind;
  label: string;
  titleId: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current!;
    dialogPolyfill.registerDialog(element);
    element.showModal();
    heading.current?.focus();
    return () => { if (element.open) element.close(); };
  }, []);

  return (
    <dialog ref={dialog} className={`island-window island-window--${island}`} aria-labelledby={titleId}
      onCancel={(event) => event.preventDefault()}>
      <div className="island-window-masthead" ref={heading} tabIndex={-1}>
        <span aria-hidden="true">✦</span>{label}
      </div>
      <div className="island-window-content">{children}</div>
    </dialog>
  );
}
