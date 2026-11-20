import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DEFAULT_CONFIG, playerName } from '@happy-voyage/shared';
import { PhaserGame } from './game/PhaserGame';
import { Atmosphere } from './ui/Atmosphere';
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
import { TutorialPanel } from './ui/TutorialPanel';
import { readPreference, writePreference } from './ui/accessibilityPreferences';
import { HelmCard, VoyageBottomBar, VoyageTopBar } from './ui/BoardChrome';
import { ShortcutLegend } from './ui/ShortcutLegend';

/** Phaser draws the sea underneath; React overlays menus and panels on top. */
export function App() {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fleetOpen, setFleetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tutorialDismissed, setTutorialDismissed] = useState(() => readPreference('tutorial-dismissed'));
  const [tutorialRequested, setTutorialRequested] = useState(false);
  const [colorBlind, setColorBlind] = useState(() => readPreference('color-blind'));
  // Re-render whenever the controller reports a state change.
  useSyncExternalStore(gameController.subscribe, gameController.getVersion);
  useLocale();
  const { t, locale } = useT();
  const state = gameController.state;
  const room = gameController.room;
  const atHelm = !!state && !state.players[state.currentPlayer].isAI && (!room || gameController.canHelm) && !gameController.awaitingHandoff && state.phase !== 'gameOver';
  const tutorialOpen = !!state && (!tutorialDismissed || tutorialRequested);
  function dismissTutorial() {
    writePreference('tutorial-dismissed', true);
    setTutorialDismissed(true);
    setTutorialRequested(false);
  }

  function toggleColorBlind() {
    const enabled = !colorBlind;
    writePreference('color-blind', enabled);
    setColorBlind(enabled);
    EventBus.emit('palette-changed', enabled);
  }

  useLayoutEffect(() => {
    document.body.classList.toggle('color-blind', colorBlind);
    return () => document.body.classList.remove('color-blind');
  }, [colorBlind]);

  const paletteToggle = <button type="button" className="palette-toggle" aria-pressed={colorBlind} onClick={toggleColorBlind}>{t('Color-blind mode', '色觉无障碍模式')}</button>;

  useEffect(() => {
    if (rulesOpen || fleetOpen || tutorialOpen || menuOpen) return;
    const shortcuts = keyboardShortcuts(gameController);
    window.addEventListener('keydown', shortcuts.keydown);
    window.addEventListener('keyup', shortcuts.keyup);
    window.addEventListener('blur', shortcuts.blur);
    return () => {
      window.removeEventListener('keydown', shortcuts.keydown);
      window.removeEventListener('keyup', shortcuts.keyup);
      window.removeEventListener('blur', shortcuts.blur);
    };
  }, [rulesOpen, fleetOpen, tutorialOpen, menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  useEffect(() => {
    const start = () => gameController.startSoundtrack();
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, []);
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
      {state && <VoyageTopBar state={state} colorBlind={colorBlind} menuOpen={menuOpen} onMenu={() => setMenuOpen(!menuOpen)} />}
      <div className="sea-map">
        <PhaserGame />
        <Atmosphere state={state} />
        {state && <SeaNotifications notices={gameController.seaNotices} onDismiss={(id) => gameController.dismissSeaNotice(id)} />}
      </div>
      <div className="overlay" ref={overlay}>
        {state ? (
          <div className="hud">
            <HelmCard state={state} colorBlind={colorBlind} atHelm={atHelm} />
            <ActionPanel state={state} colorBlind={colorBlind} />
            <div className={`secondary-hud ${menuOpen ? 'is-open' : ''}`}>
            {menuOpen && <button className="menu-scrim" aria-label={t('Close menu', '关闭菜单')} onClick={() => setMenuOpen(false)} />}
            <div id="voyage-menu" className="voyage-menu">
            <button className="menu-close" onClick={() => setMenuOpen(false)}>{t('Close menu', '关闭菜单')} ✕</button>
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
            {state.campaign && <CampaignPanel campaign={state.campaign} />}
            <PlayerBar state={state} colorBlind={colorBlind} paletteToggle={paletteToggle} onRules={() => { setMenuOpen(false); setRulesOpen(true); }} onFleet={() => { setMenuOpen(false); setFleetOpen(true); }} onTutorial={() => { setMenuOpen(false); setTutorialRequested(true); }} />
            <div className="mobile-log"><LogPanel log={gameController.visibleLogText(state)} state={state} tones={gameController.feedback.logTones} /></div>
            <RouteDetails state={state} />
            <div className="menu-shortcuts"><ShortcutLegend /></div>
            </div>
            </div>
          </div>
        ) : room ? <OnlineMenu room={room} /> : (
          <SetupMenu onRules={() => setRulesOpen(true)} paletteToggle={paletteToggle} />
        )}
        {state && fleetOpen && <FleetPanel players={state.players} onClose={() => setFleetOpen(false)} />}
        {tutorialOpen && <TutorialPanel onClose={dismissTutorial} />}
        {rulesOpen && <RulesPanel config={state?.config ?? DEFAULT_CONFIG} islandCount={state?.map.filter((node) => node.kind === 'island').length} campaign={state?.campaign} onClose={() => setRulesOpen(false)} />}
      </div>
      {state && <VoyageBottomBar state={state} atHelm={atHelm} />}
    </div>
  );
}
