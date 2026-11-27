import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { canOpenVoyageLog, LogPanel, VoyageLogButton, VoyageLogHistory } from './ui/LogPanel';
import { RulesPanel } from './ui/RulesPanel';
import { EventBus } from './game/EventBus';
import { RouteDetails } from './ui/RouteDetails';
import { keyboardShortcuts } from './game/keyboard';
import { listenForSoundtrackStart, resumeSoundtrack } from './game/sfx';
import { FleetPanel } from './ui/FleetPanel';
import { SeaNotifications } from './ui/SeaNotifications';
import { TutorialPanel } from './ui/TutorialPanel';
import { TurnIndicator } from './ui/TurnIndicator';
import { readPreference, writePreference } from './ui/accessibilityPreferences';
import { HelmCard, LandingHeading, NextStop, VoyageBottomBar, VoyageTopBar } from './ui/BoardChrome';
import { ShortcutLegend } from './ui/ShortcutLegend';
import { TurnCoach } from './ui/TurnCoach';
import { MenuDialog } from './ui/MenuDialog';
import { VoyageLanding } from './ui/VoyageLanding';
import { IslandWindow, islandWindowFor } from './ui/IslandWindow';

/** Phaser draws the sea underneath; React overlays menus and panels on top. */
export function App({ initialTutorialDismissed, expandStrategies }: {
  initialTutorialDismissed?: boolean;
  expandStrategies?: boolean;
} = {}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fleetOpen, setFleetOpen] = useState(false);
  const [fleetPlayerId, setFleetPlayerId] = useState<number | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const openFleet = (playerId?: number) => {
    setMenuOpen(false);
    setFleetPlayerId(playerId);
    setFleetOpen(true);
  };
  const [setupOpen, setSetupOpen] = useState(false);
  const [chartFocus, setChartFocus] = useState<{ x: number; y: number; bottom: boolean } | null>(null);
  useEffect(() => {
    const update = (focus: typeof chartFocus) => setChartFocus(old => JSON.stringify(old) === JSON.stringify(focus) ? old : focus);
    EventBus.on('chart-focus', update);
    return () => { EventBus.off('chart-focus', update); };
  }, []);
  const [tutorialDismissed, setTutorialDismissed] = useState(() => initialTutorialDismissed ?? readPreference('tutorial-dismissed'));
  const [tutorialRequested, setTutorialRequested] = useState(false);
  const [colorBlind, setColorBlind] = useState(() => readPreference('color-blind'));
  // Re-render whenever the controller reports a state change.
  useSyncExternalStore(gameController.subscribe, gameController.getVersion);
  useLocale();
  const { t, locale } = useT();
  const state = gameController.state;
  const room = gameController.room;
  const awaitingHandoff = gameController.awaitingHandoff;
  const logAvailable = canOpenVoyageLog(state?.phase, awaitingHandoff);
  const openLog = logAvailable ? () => setLogOpen(true) : undefined;
  if (logOpen && !logAvailable) {
    setLogOpen(false);
    setMenuOpen(false);
  }
  const coverOpen = !state && !room && !setupOpen;
  const atHelm = !!state && !state.players[state.currentPlayer].isAI && (!room || gameController.canHelm) && !awaitingHandoff && state.phase !== 'gameOver';
  const islandWindow = state && islandWindowFor(state, atHelm);
  const landing = atHelm && !islandWindow && state.phase.startsWith('awaiting') && state.phase !== 'awaitingSpin' && state.phase !== 'awaitingBattle';
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
    if (coverOpen || rulesOpen || fleetOpen || tutorialOpen || menuOpen || logOpen) return;
    const shortcuts = keyboardShortcuts(gameController, { onFleet: () => openFleet() });
    window.addEventListener('keydown', shortcuts.keydown);
    window.addEventListener('keyup', shortcuts.keyup);
    window.addEventListener('blur', shortcuts.blur);
    return () => {
      window.removeEventListener('keydown', shortcuts.keydown);
      window.removeEventListener('keyup', shortcuts.keyup);
      window.removeEventListener('blur', shortcuts.blur);
    };
  }, [coverOpen, rulesOpen, fleetOpen, tutorialOpen, menuOpen, logOpen]);
  useEffect(() => {
    const stop = listenForSoundtrackStart(window, () => gameController.startSoundtrack());
    const onVisibilityChange = () => { if (!document.hidden) resumeSoundtrack(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
  const overlay = useRef<HTMLDivElement>(null);
  const needsInput = state && !state.players[state.currentPlayer].isAI &&
    (state.phase === 'awaitingSpin' || state.phase === 'awaitingClaim' ||
      state.phase === 'awaitingRecruit' || state.phase === 'awaitingLottery' || state.phase === 'awaitingBarter' || state.phase === 'awaitingCargoMarket' || state.phase === 'awaitingToll' ||
      state.phase === 'awaitingMerchant' || state.phase === 'awaitingWyvern' || state.phase === 'awaitingRevival');
  const prompt = state && (needsInput || landing) ? `${state.round}:${state.currentPlayer}:${state.phase}` : null;
  const map = state?.map;
  const chartKey = useMemo(() => map ? JSON.stringify(map) : 'default-chart', [map]);
  useLayoutEffect(() => {
    if (prompt && overlay.current) overlay.current.scrollTop = 0;
  }, [prompt]);

  if (coverOpen) return <div className="app"><VoyageLanding onStart={() => setSetupOpen(true)} onOnline={() => gameController.openOnline()} /></div>;

  return (
    <div className={`app ${state ? 'playing' : ''} ${state?.phase === 'awaitingBattle' ? 'battling' : ''}`}>
      {state && <VoyageTopBar state={state} colorBlind={colorBlind} menuOpen={menuOpen} onMenu={() => setMenuOpen(!menuOpen)} onFleet={openFleet} />}
      <div className="sea-map">
        <PhaserGame key={chartKey} />
        <Atmosphere state={state} />
        {state && <div className="board-notices">
          <TurnIndicator state={state} notice={gameController.turnNotice} action={gameController.turnAction} />
          <SeaNotifications notices={gameController.seaNotices} onDismiss={(id) => gameController.dismissSeaNotice(id)} />
        </div>}
      </div>
      <div className={`overlay ${landing ? 'has-landing' : ''} ${atHelm ? 'is-your-turn' : ''}`} ref={overlay}>
        {state ? (
          <div className="hud">
            <div className="hud-menu-tools menu-dialog-tools">
              <button type="button" onClick={() => openFleet()}>⚓ {t('Fleet', '舰队')}</button>
              <button type="button" onClick={() => setMenuOpen(true)}>⚙ {t('Menu', '菜单')}</button>
            </div>
            <HelmCard state={state} colorBlind={colorBlind} atHelm={atHelm} onFleet={openFleet} />
            <NextStop state={state} />
            {landing && <p className="landing-hint">⚓ {t('Choose an action on the card', '请在卡片上选择行动')}</p>}
            {!islandWindow && !landing && <section className="turn-action-panel">
            <ActionPanel state={state} colorBlind={colorBlind} expandStrategies={expandStrategies} />
            </section>}
            {!tutorialOpen && <TurnCoach state={state} atHelm={atHelm} target={chartFocus} />}
          </div>
        ) : room ? <OnlineMenu room={room} /> : (
          <SetupMenu onRules={() => setRulesOpen(true)} paletteToggle={paletteToggle} onBack={() => setSetupOpen(false)} />
        )}
      </div>
      {state && landing && <MenuDialog key={prompt} className="landing-placement" label={t('Choose an action on the card', '请在卡片上选择行动')}
        suspended={rulesOpen || fleetOpen || menuOpen || tutorialOpen}>
        <div className="menu-dialog-tools">
          <button type="button" onClick={() => openFleet()}>⚓ {t('Fleet', '舰队')}</button>
          <button type="button" onClick={() => setMenuOpen(true)}>⚙ {t('Menu', '菜单')}</button>
        </div>
        <LandingHeading state={state} />
        <ActionPanel state={state} colorBlind={colorBlind} expandStrategies={expandStrategies} />
      </MenuDialog>}
      {state && menuOpen && <MenuDialog id="voyage-menu" className="voyage-menu" label={t('Menu', '菜单')} suspended={logOpen} onDismiss={() => setMenuOpen(false)}>
            <button className="menu-close" onClick={() => setMenuOpen(false)}>{t('Close menu', '关闭菜单')} ✕</button>
            <div className="chart-controls"><button onClick={() => EventBus.emit('fit-chart')}>{t('Fit chart', '查看全图')}</button><button onClick={() => EventBus.emit('follow-ship')}>{t('Follow ship', '跟随船只')}</button></div>
            {room && (
              <div className="panel room-status">
                <span role="status">{room.lobby?.failed ? t('The room server stopped this voyage.', '房间服务器已终止本次航程。') : room.ready ?
                  t('Online · You are {p}', '在线 · 你是 {p}', { p: playerName(state.players[gameController.viewerId!], locale) }) : t('Room connection lost. Trying to reconnect…', '与房间的连接已断开，正在重新连接……')}</span>
                {room.error && <span role="alert">{roomError(room.error, locale)}</span>}
                {state.phase !== 'gameOver' && <button onClick={() => {
                  if (window.confirm(t('Leave this voyage? You can reopen your invite in this tab to return to your seat.', '离开本次航程？在此标签页重新打开邀请链接即可回到你的座位。'))) {
                    setMenuOpen(false);
                    gameController.quit();
                  }
                }}>{t('Leave room', '离开房间')}</button>}
              </div>
            )}
            {state.campaign && <CampaignPanel campaign={state.campaign} />}
            <PlayerBar state={state} colorBlind={colorBlind} paletteToggle={paletteToggle} onRules={() => { setMenuOpen(false); setRulesOpen(true); }} onFleet={() => openFleet()} onTutorial={() => { setMenuOpen(false); setTutorialRequested(true); }} />
            <div className="voyage-menu-log">
              {openLog && <VoyageLogButton onOpen={openLog} />}
              <LogPanel log={gameController.visibleLogText(state)} state={state} tones={gameController.feedback.logTones} limit={3} />
            </div>
            <RouteDetails state={state} />
            <div className="menu-shortcuts"><ShortcutLegend /></div>
      </MenuDialog>}
        {state && fleetOpen && <FleetPanel players={state.players} state={state} initialPlayerId={fleetPlayerId} onClose={() => setFleetOpen(false)} />}
        {tutorialOpen && <TutorialPanel onClose={dismissTutorial} />}
        {rulesOpen && <RulesPanel config={state?.config ?? DEFAULT_CONFIG} islandCount={state?.map.filter((node) => node.kind === 'island').length} campaign={state?.campaign} onClose={() => setRulesOpen(false)} />}
      {state && islandWindow &&
        <IslandWindow key={islandWindow.island} state={state} activity={islandWindow} onFleet={() => openFleet()} onMenu={() => setMenuOpen(true)} suspended={rulesOpen || fleetOpen || menuOpen || tutorialOpen || logOpen} />}
      {state && <VoyageBottomBar state={state} atHelm={atHelm} onLog={openLog} />}
      {state && logOpen && <VoyageLogHistory state={state} log={gameController.visibleLogText(state)} tones={gameController.feedback.logTones} onDismiss={() => setLogOpen(false)} />}
    </div>
  );
}
