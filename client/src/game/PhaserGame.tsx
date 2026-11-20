import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './config';

/** Mounts the Phaser canvas into a React-managed div. */
export function PhaserGame() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const game = new Phaser.Game(createGameConfig(container.current!));
    return () => game.destroy(true);
  }, []);

  return <div ref={container} className="phaser-container" />;
}
