import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './config';

/** Mounts the Phaser canvas into a React-managed div. */
export function PhaserGame() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = container.current!;
    const game = new Phaser.Game(createGameConfig(parent));
    let resizeFrame = 0;
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (!game.isBooted) return;
        game.scale.getParentBounds();
        game.scale.refresh();
      });
    });
    resize.observe(parent);
    return () => {
      resize.disconnect();
      cancelAnimationFrame(resizeFrame);
      game.destroy(true);
    };
  }, []);

  return <div ref={container} className="phaser-container" />;
}
