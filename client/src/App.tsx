import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DEFAULT_CONFIG } from '@happy-voyage/shared';
import { PhaserGame } from './game/PhaserGame';
import { gameController } from './game/GameController';
import { SetupMenu } from './ui/SetupMenu';
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

/** Phaser draws the sea underneath; React overlays menus and panels on top. */
export function App() {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fleetOpen, setFleetOpen] = useState(false);
  const [tutorialDismissed, setTutorialDismissed] = useState(() => readPreference('tutorial-dismissed'));
  const [tutorialRequested, setTutorialRequested] = useState(false);
  const [colorBlind, setColorBlind] = useState(() => readPreference('color-blind'));
  // Re-render whenever the controller reports a state change.
  useSyncExternalStore(gameController.subscribe, gameController.getVersion);
  const state = gameController.state;
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

  const paletteToggle = <button type="button" className="palette-toggle" aria-pressed={colorBlind} onClick={toggleColorBlind}>Color-blind mode</button>;

  useEffect(() => {
    if (rulesOpen || fleetOpen || tutorialOpen) return;
    const shortcuts = keyboardShortcuts(gameController);
    window.addEventListener('keydown', shortcuts.keydown);
    window.addEventListener('keyup', shortcuts.keyup);
    window.addEventListener('blur', shortcuts.blur);
    return () => {
      window.removeEventListener('keydown', shortcuts.keydown);
      window.removeEventListener('keyup', shortcuts.keyup);
      window.removeEventListener('blur', shortcuts.blur);
    };
  }, [rulesOpen, fleetOpen, tutorialOpen]);
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
            <div className="chart-controls"><button onClick={() => EventBus.emit('fit-chart')}>Fit chart</button><button onClick={() => EventBus.emit('follow-ship')}>Follow ship</button></div>
            <ActionPanel state={state} colorBlind={colorBlind} />
            {state.campaign && <CampaignPanel campaign={state.campaign} />}
            <PlayerBar state={state} colorBlind={colorBlind} paletteToggle={paletteToggle} onRules={() => setRulesOpen(true)} onFleet={() => setFleetOpen(true)} onTutorial={() => setTutorialRequested(true)} />
            <LogPanel log={gameController.visibleLog(state)} tones={gameController.feedback.logTones} />
            <RouteDetails state={state} />
          </div>
        ) : (
          <SetupMenu onRules={() => setRulesOpen(true)} paletteToggle={paletteToggle} />
        )}
        {state && fleetOpen && <FleetPanel players={state.players} onClose={() => setFleetOpen(false)} />}
        {tutorialOpen && <TutorialPanel onClose={dismissTutorial} />}
        {rulesOpen && <RulesPanel config={state?.config ?? DEFAULT_CONFIG} islandCount={state?.map.filter((node) => node.kind === 'island').length} campaign={state?.campaign} onClose={() => setRulesOpen(false)} />}
      </div>
    </div>
  );
}
