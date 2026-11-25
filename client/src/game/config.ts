import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { OceanScene } from './scenes/OceanScene';
import { BattleScene } from './scenes/BattleScene';

/** Phaser game config: a fixed-size world scaled to fit the browser window. */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: '#0b4f7c',
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
    scene: [BootScene, OceanScene, BattleScene],
  };
}
