import { useEffect, useState, useSyncExternalStore } from 'react';
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

/** Phaser draws the sea underneath; React overlays menus and panels on top. */
export function App() {
  const [rulesOpen, setRulesOpen] = useState(false);
  useEffect(() => {
    if (rulesOpen) return;
    const shortcuts = keyboardShortcuts(gameController);
    window.addEventListener('keydown', shortcuts.keydown);
    window.addEventListener('keyup', shortcuts.keyup);
    window.addEventListener('blur', shortcuts.blur);
    return () => {
      window.removeEventListener('keydown', shortcuts.keydown);
      window.removeEventListener('keyup', shortcuts.keyup);
      window.removeEventListener('blur', shortcuts.blur);
    };
  }, [rulesOpen]);
  // Re-render whenever the controller reports a state change.
  useSyncExternalStore(gameController.subscribe, gameController.getVersion);
  const state = gameController.state;

  return (
    <div className={`app ${state ? 'playing' : ''}`}>
      <PhaserGame />
      <div className="overlay">
        {state ? (
          <div className="hud">
            <div className="chart-controls"><button onClick={() => EventBus.emit('fit-chart')}>Fit chart</button><button onClick={() => EventBus.emit('follow-ship')}>Follow ship</button></div>
            <PlayerBar state={state} onRules={() => setRulesOpen(true)} />
            <ActionPanel state={state} />
            <LogPanel log={state.log} tones={gameController.feedback.logTones} />
            <RouteDetails state={state} />
          </div>
        ) : (
          <SetupMenu onRules={() => setRulesOpen(true)} />
        )}
        {rulesOpen && <RulesPanel config={state?.config ?? DEFAULT_CONFIG} onClose={() => setRulesOpen(false)} />}
      </div>
    </div>
  );
}
