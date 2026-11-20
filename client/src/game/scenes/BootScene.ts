import Phaser from 'phaser';

/**
 * Generates the placeholder art procedurally so the demo needs no asset files.
 * Swap these for real sprites later with `this.load.image(...)` in preload().
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.add.graphics();

    // Ship token: white hull and sail, tinted per player at runtime.
    g.fillStyle(0xffffff);
    g.fillTriangle(16, 2, 16, 24, 30, 22);
    g.fillRect(15, 2, 2, 24);
    g.fillTriangle(2, 26, 34, 26, 28, 34);
    g.fillRect(8, 26, 20, 8);
    g.generateTexture('ship', 36, 36);
    g.clear();

    // Island: sand ring with green interior.
    g.fillStyle(0xf2d38b);
    g.fillCircle(24, 24, 24);
    g.fillStyle(0x4caf50);
    g.fillCircle(24, 22, 16);
    g.fillStyle(0x2e7d32);
    g.fillCircle(19, 18, 6);
    g.fillCircle(29, 24, 5);
    g.generateTexture('island', 48, 48);
    g.clear();

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
    g.generateTexture('wave', 36, 16);
    g.destroy();

    this.scene.start('Ocean');
  }
}
