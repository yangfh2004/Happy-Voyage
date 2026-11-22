import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './config';
import { waitForSeaFont } from './chartStartup';

/** Mounts the Phaser canvas into a React-managed div. */
export function PhaserGame() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: Phaser.Game | undefined;
    let disposed = false;
    let resizeFrame = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (game?.isBooted) game.scale.resize(entry.contentRect.width, entry.contentRect.height);
      });
    });
    void waitForSeaFont(() => document.fonts.load('14px "Sea Names"', '航')).then(() => {
      if (disposed) return;
      game = new Phaser.Game(createGameConfig(container.current!));
      observer.observe(container.current!);
    });
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(resizeFrame); game?.destroy(true); };
  }, []);

  return <div ref={container} className="phaser-container" />;
}
