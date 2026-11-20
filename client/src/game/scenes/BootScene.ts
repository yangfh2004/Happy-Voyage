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

    // Island: sand ring with green interior.
    g.fillStyle(0x88f4e6, 0.45).fillEllipse(36, 44, 72, 43);
    g.lineStyle(2, 0xe5fffa, 0.85).strokeEllipse(36, 44, 68, 38);
    g.fillStyle(0xe7ad57).fillEllipse(36, 43, 59, 34);
    g.fillStyle(0xffe7a0).fillEllipse(36, 39, 60, 32);
    g.fillStyle(0x27b969).fillEllipse(34, 33, 44, 28);
    g.fillStyle(0x73e47b).fillEllipse(28, 29, 28, 21);
    g.lineStyle(5, 0xa9703e).lineBetween(43, 37, 40, 14);
    g.lineStyle(2, 0xf4c77e).lineBetween(44, 36, 41, 15);
    g.fillStyle(0x148950).fillEllipse(31, 13, 24, 9).fillEllipse(49, 13, 24, 9);
    g.fillStyle(0x35cf69).fillEllipse(35, 8, 11, 20).fillEllipse(47, 8, 11, 20);
    g.fillStyle(0xffc76a).fillCircle(41, 17, 3);
    g.generateTexture('island', 72, 66);
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
