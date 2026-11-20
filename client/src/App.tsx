import { useState, useSyncExternalStore } from 'react';
import { DEFAULT_CONFIG } from '@happy-voyage/shared';
import { PhaserGame } from './game/PhaserGame';
import { gameController } from './game/GameController';
import { SetupMenu } from './ui/SetupMenu';
import { PlayerBar } from './ui/PlayerBar';
import { ActionPanel } from './ui/ActionPanel';
import { LogPanel } from './ui/LogPanel';
import { RulesPanel } from './ui/RulesPanel';

/** Phaser draws the sea underneath; React overlays menus and panels on top. */
export function App() {
  // Re-render whenever the controller reports a state change.
  useSyncExternalStore(gameController.subscribe, gameController.getVersion);
  const state = gameController.state;
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="app">
      <PhaserGame />
      <div className="overlay">
        {state ? (
          <div className="hud">
            <button className="rules-toggle" onClick={() => setRulesOpen(true)}> ? Rules</button>
            <PlayerBar state={state} />
            <ActionPanel state={state} />
            <LogPanel log={state.log} />
          </div>
        ) : (
          <SetupMenu onRules={() => setRulesOpen(true)} />
        )}
        {rulesOpen && <RulesPanel config={state?.config ?? DEFAULT_CONFIG} onClose={() => setRulesOpen(false)} />}
      </div>
    </div>
  );
}
