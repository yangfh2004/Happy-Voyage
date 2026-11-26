import { useLayoutEffect, useRef, type ComponentType } from 'react';
import dialogPolyfill from 'dialog-polyfill';
import { nodeName, type GameState, type SpecialKind } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { LotteryPanel } from './LotteryPanel';
import { MistPanel } from './MistPanel';
import { ShipMarketPanel } from './ShipMarketPanel';
import { RecruitPanel } from './RecruitPanel';
import { BarterPanel } from './BarterPanel';
import { MarketPanel } from './MarketPanel';
import { RevivalPanel } from './RevivalPanel';
import './IslandWindow.css';

interface IslandActivity {
  island: SpecialKind;
  titleId: string;
  Panel: ComponentType<{ state: GameState }>;
}

const islandActivities: Partial<Record<GameState['phase'], IslandActivity>> = {
  awaitingLottery: { island: 'treasure', titleId: 'lottery-title', Panel: LotteryPanel },
  awaitingMistDuel: { island: 'mist', titleId: 'mist-title', Panel: MistPanel },
  awaitingMarket: { island: 'skeleton', titleId: 'ship-market-title', Panel: ShipMarketPanel },
  awaitingRecruit: { island: 'dragonSnake', titleId: 'recruit-title', Panel: RecruitPanel },
  awaitingBarter: { island: 'wind', titleId: 'barter-title', Panel: BarterPanel },
  awaitingCargoMarket: { island: 'nightless', titleId: 'market-title', Panel: MarketPanel },
  awaitingRevival: { island: 'revival', titleId: 'revival-title', Panel: RevivalPanel },
};

export function islandWindowFor(state: GameState, canHelm: boolean): IslandActivity | null {
  const player = state.players[state.currentPlayer];
  if (!canHelm || player.isAI) return null;
  const activity = islandActivities[state.phase];
  return activity && state.map[player.position]?.special === activity.island ? activity : null;
}

export function IslandWindow({ state, activity: { island, titleId, Panel }, onFleet, suspended = false }: { state: GameState; activity: IslandActivity; onFleet?: () => void; suspended?: boolean }) {
  const { t, locale } = useT();
  const label = nodeName(state.map[state.players[state.currentPlayer].position], locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current!;
    dialogPolyfill.registerDialog(element);
    if (suspended) {
      if (element.open) element.close();
      return;
    }
    if (!element.open) {
      element.showModal();
      heading.current?.focus();
    }
    return () => { if (element.open) element.close(); };
  }, [suspended]);

  return (
    <dialog ref={dialog} className={`island-window island-window--${island}`} aria-labelledby={titleId}
      onCancel={(event) => event.preventDefault()}>
      <div className="island-window-masthead" ref={heading} tabIndex={-1}>
        <span aria-hidden="true">✦</span>
        <span>{label}</span>
        {onFleet && <button type="button" className="island-fleet-btn" onClick={onFleet}>⚓ {t('Fleet', '舰队')}</button>}
      </div>
      <div className="island-window-content"><Panel state={state} /></div>
    </dialog>
  );
}
