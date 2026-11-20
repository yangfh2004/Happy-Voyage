import { useSyncExternalStore } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { gameController } from './game/GameController';
import { SetupMenu } from './ui/SetupMenu';
import { PlayerBar } from './ui/PlayerBar';
import { ActionPanel } from './ui/ActionPanel';
import { LogPanel } from './ui/LogPanel';

/** Phaser draws the sea underneath; React overlays menus and panels on top. */
export function App() {
  // Re-render whenever the controller reports a state change.
  useSyncExternalStore(gameController.subscribe, gameController.getVersion);
  const state = gameController.state;

  return (
    <div className="app">
      <PhaserGame />
      <div className="overlay">
        {state ? (
          <div className="hud">
            <PlayerBar state={state} />
            <ActionPanel state={state} />
            <LogPanel log={state.log} />
          </div>
        ) : (
          <SetupMenu />
        )}
      </div>
    </div>
  );
}
