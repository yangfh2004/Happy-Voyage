import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './config';
import { waitForSeaFont } from './chartStartup';
import { gameController } from './GameController';

/** Mounts the Phaser canvas into a React-managed div. */
export function PhaserGame() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: Phaser.Game | undefined;
    let disposed = false;
    let resizeFrame = 0;
    const syncBattle = () => {
      if (!game?.scene.isActive('Ocean') && !game?.scene.isSleeping('Ocean')) return;
      const battling = !gameController.room && gameController.state?.phase === 'awaitingBattle' && !!gameController.state.pendingBattle?.commanders.length;
      if (battling && !game.scene.isActive('Battle')) {
        game.scene.sleep('Ocean');
        game.scene.start('Battle');
      } else if (!battling && game.scene.isActive('Battle')) {
        game.scene.stop('Battle');
        game.scene.wake('Ocean');
      }
    };
    const unsubscribe = gameController.subscribe(syncBattle);
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (game?.isBooted) game.scale.resize(entry.contentRect.width, entry.contentRect.height);
      });
    });
    void waitForSeaFont(() => document.fonts.load('14px "Sea Names"', '航')).then(() => {
      if (disposed) return;
      game = new Phaser.Game(createGameConfig(container.current!));
      game.events.on(Phaser.Core.Events.POST_STEP, syncBattle);
      observer.observe(container.current!);
    });
    return () => { disposed = true; unsubscribe(); observer.disconnect(); cancelAnimationFrame(resizeFrame); game?.destroy(true); };
  }, []);

  return <div ref={container} className="phaser-container" />;
}
