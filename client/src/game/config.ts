import Phaser from 'phaser';
import { WORLD } from '@happy-voyage/shared';
import { BootScene } from './scenes/BootScene';
import { OceanScene } from './scenes/OceanScene';

/** Phaser game config: a fixed-size world scaled to fit the browser window. */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: WORLD.width,
    height: WORLD.height,
    backgroundColor: '#0b4f7c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, OceanScene],
  };
}
