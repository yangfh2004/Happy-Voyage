import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DEFAULT_CONFIG, playerName } from '@happy-voyage/shared';
import { PhaserGame } from './game/PhaserGame';
import { gameController } from './game/GameController';
import { SetupMenu } from './ui/SetupMenu';
import { useLocale, useT } from './i18n';
import { OnlineMenu, roomError } from './ui/OnlineMenu';
import { PlayerBar } from './ui/PlayerBar';
import { ActionPanel } from './ui/ActionPanel';
import { CampaignPanel } from './ui/CampaignPanel';
import { LogPanel } from './ui/LogPanel';
import { RulesPanel } from './ui/RulesPanel';
import { EventBus } from './game/EventBus';
import { RouteDetails } from './ui/RouteDetails';
import { keyboardShortcuts } from './game/keyboard';
import { FleetPanel } from './ui/FleetPanel';
import { SeaNotifications } from './ui/SeaNotifications';

/** Phaser draws the sea underneath; React overlays menus and panels on top. */
export function App() {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fleetOpen, setFleetOpen] = useState(false);
  useEffect(() => {
    if (rulesOpen || fleetOpen) return;
    const shortcuts = keyboardShortcuts(gameController);
    window.addEventListener('keydown', shortcuts.keydown);
    window.addEventListener('keyup', shortcuts.keyup);
    window.addEventListener('blur', shortcuts.blur);
    return () => {
      window.removeEventListener('keydown', shortcuts.keydown);
      window.removeEventListener('keyup', shortcuts.keyup);
      window.removeEventListener('blur', shortcuts.blur);
    };
  }, [rulesOpen, fleetOpen]);
  useEffect(() => {
    const start = () => gameController.startSoundtrack();
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, []);
  // Re-render whenever the controller reports a state change.
  useSyncExternalStore(gameController.subscribe, gameController.getVersion);
  const { t, locale } = useT();
  useLocale();
  const state = gameController.state;
  const room = gameController.room;
  const overlay = useRef<HTMLDivElement>(null);
  const needsInput = state && !state.players[state.currentPlayer].isAI &&
    (state.phase === 'awaitingSpin' || state.phase === 'awaitingClaim' ||
      state.phase === 'awaitingRecruit' || state.phase === 'awaitingLottery' || state.phase === 'awaitingBarter' || state.phase === 'awaitingCargoMarket' || state.phase === 'awaitingToll' ||
      state.phase === 'awaitingMerchant' || state.phase === 'awaitingWyvern');
  const prompt = needsInput ? `${state.round}:${state.currentPlayer}:${state.phase}` : null;
  useLayoutEffect(() => {
    if (prompt && overlay.current) overlay.current.scrollTop = 0;
  }, [prompt]);

  return (
    <div className={`app ${state ? 'playing' : ''}`}>
      <div className="sea-map">
        <PhaserGame />
        {state && <SeaNotifications notices={gameController.seaNotices} onDismiss={(id) => gameController.dismissSeaNotice(id)} />}
      </div>
      <div className="overlay" ref={overlay}>
        {state ? (
          <div className="hud">
            <div className="chart-controls"><button onClick={() => EventBus.emit('fit-chart')}>{t('Fit chart', '查看全图')}</button><button onClick={() => EventBus.emit('follow-ship')}>{t('Follow ship', '跟随船只')}</button></div>
            {room && (
              <div className="panel room-status">
                <span role="status">{room.lobby?.failed ? t('The room server stopped this voyage.', '房间服务器已终止本次航程。') : room.ready ?
                  t('Online · You are {p}', '在线 · 你是 {p}', { p: playerName(state.players[gameController.viewerId!], locale) }) : t('Room connection lost. Trying to reconnect…', '与房间的连接已断开，正在重新连接……')}</span>
                {room.error && <span role="alert">{roomError(room.error, locale)}</span>}
                {state.phase !== 'gameOver' && <button onClick={() => {
                  if (window.confirm(t('Leave this voyage? You can reopen your invite in this tab to return to your seat.', '离开本次航程？在此标签页重新打开邀请链接即可回到你的座位。'))) gameController.quit();
                }}>{t('Leave room', '离开房间')}</button>}
              </div>
            )}
            <ActionPanel state={state} />
            {state.campaign && <CampaignPanel campaign={state.campaign} />}
            <PlayerBar state={state} onRules={() => setRulesOpen(true)} onFleet={() => setFleetOpen(true)} />
            <LogPanel log={gameController.visibleLogText(state)} state={state} tones={gameController.feedback.logTones} />
            <RouteDetails state={state} />
          </div>
        ) : room ? <OnlineMenu room={room} /> : (
          <SetupMenu onRules={() => setRulesOpen(true)} />
        )}
        {state && fleetOpen && <FleetPanel players={state.players} onClose={() => setFleetOpen(false)} />}
        {rulesOpen && <RulesPanel config={state?.config ?? DEFAULT_CONFIG} islandCount={state?.map.filter((node) => node.kind === 'island').length} campaign={state?.campaign} onClose={() => setRulesOpen(false)} />}
      </div>
    </div>
  );
}
