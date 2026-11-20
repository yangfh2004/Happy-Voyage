import Phaser from 'phaser';

/** Generates shared ship, coin and wave icons. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.add.graphics();

    // Ship token: white hull and sail, tinted per player at runtime.
    g.fillStyle(0x123f66, 0.25).fillEllipse(27, 47, 50, 12);
    g.fillStyle(0xffdc86).fillRoundedRect(7, 32, 42, 17, 9);
    g.fillStyle(0xb66b3f).fillRoundedRect(10, 37, 36, 10, 5);
    g.fillStyle(0xfff2c2).fillRect(25, 4, 3, 34);
    g.fillStyle(0xffffff).fillTriangle(24, 5, 8, 30, 24, 28);
    g.fillStyle(0xffffff).fillEllipse(36, 21, 23, 27);
    g.fillStyle(0xfff6d6).fillTriangle(28, 6, 28, 33, 46, 31);
    g.fillStyle(0x244962).fillCircle(18, 40, 2).fillCircle(28, 40, 2).fillCircle(38, 40, 2);
    g.fillStyle(0xffffff).fillTriangle(28, 3, 43, 7, 28, 11);
    g.generateTexture('ship', 56, 56);
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
