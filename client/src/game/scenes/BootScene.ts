import Phaser from 'phaser';
import { createDefaultMap } from '@happy-voyage/shared';
import { specialIslandTexture } from '../specialIslandArt';
import { harbourTexture } from '../harbourArt';

/** Generates shared coin and wave icons. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.add.graphics();

    // Gold coin for tolls and treasure.
    g.fillStyle(0xb8860b);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0xffd54f);
    g.fillCircle(8, 8, 6);
    g.fillStyle(0xfff3c4);
    g.fillRect(6, 4, 2, 8);
    g.generateTexture('coin', 16, 16);
    g.clear();

    // Wave crest used for the animated ocean.
    g.lineStyle(3, 0xffffff, 0.35);
    g.beginPath();
    g.arc(10, 12, 8, Math.PI * 1.1, Math.PI * 1.9);
    g.strokePath();
    g.beginPath();
    g.arc(26, 12, 8, Math.PI * 1.1, Math.PI * 1.9);
    g.strokePath();
    g.lineStyle(1, 0xffffff, .5).lineBetween(14, 18, 27, 18).lineBetween(39, 3, 39, 11).lineBetween(35, 7, 43, 7);
    g.generateTexture('wave', 46, 22);
    g.destroy();

    for (const node of createDefaultMap()) {
      if (node.kind === 'port') harbourTexture(this, node);
      if (node.kind === 'special' || node.kind === 'event') specialIslandTexture(this, node);
    }
    this.scene.start('Ocean');
  }
}
