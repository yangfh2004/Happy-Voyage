import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DEFAULT_CONFIG } from '@happy-voyage/shared';
import { PhaserGame } from './game/PhaserGame';
import { gameController } from './game/GameController';
import { SetupMenu } from './ui/SetupMenu';
import { PlayerBar } from './ui/PlayerBar';
import { ActionPanel } from './ui/ActionPanel';
import { LogPanel } from './ui/LogPanel';
import { RulesPanel } from './ui/RulesPanel';
import { EventBus } from './game/EventBus';
import { RouteDetails } from './ui/RouteDetails';
import { keyboardShortcuts } from './game/keyboard';
import { FleetPanel } from './ui/FleetPanel';

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
  // Re-render whenever the controller reports a state change.
  useSyncExternalStore(gameController.subscribe, gameController.getVersion);
  const state = gameController.state;
  const overlay = useRef<HTMLDivElement>(null);
  const needsInput = state && !state.players[state.currentPlayer].isAI &&
    (state.phase === 'awaitingSpin' || state.phase === 'awaitingClaim');
  const prompt = needsInput ? `${state.round}:${state.currentPlayer}:${state.phase}` : null;
  useLayoutEffect(() => {
    if (prompt && overlay.current) overlay.current.scrollTop = 0;
  }, [prompt]);

  return (
    <div className={`app ${state ? 'playing' : ''}`}>
      <PhaserGame />
      <div className="overlay" ref={overlay}>
        {state ? (
          <div className="hud">
            <div className="chart-controls"><button onClick={() => EventBus.emit('fit-chart')}>Fit chart</button><button onClick={() => EventBus.emit('follow-ship')}>Follow ship</button></div>
            <ActionPanel state={state} />
            <PlayerBar state={state} onRules={() => setRulesOpen(true)} onFleet={() => setFleetOpen(true)} />
            <LogPanel log={state.log} tones={gameController.feedback.logTones} />
            <RouteDetails state={state} />
          </div>
        ) : (
          <SetupMenu onRules={() => setRulesOpen(true)} />
        )}
        {state && fleetOpen && <FleetPanel players={state.players} onClose={() => setFleetOpen(false)} />}
        {rulesOpen && <RulesPanel config={state?.config ?? DEFAULT_CONFIG} onClose={() => setRulesOpen(false)} />}
      </div>
    </div>
  );
}
