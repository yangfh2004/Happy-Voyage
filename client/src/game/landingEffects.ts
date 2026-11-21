import type Phaser from 'phaser';

export function reducedLandingMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function playLanding(scene: Phaser.Scene, ship: Phaser.GameObjects.Image, onComplete: () => void): { stop(): void } | undefined {
  if (reducedLandingMotion()) return;
  const x = ship.x, y = ship.y + 39 * ship.scaleY;
  const graphics: Phaser.GameObjects.Graphics[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    tweens.forEach(tween => tween.stop());
    graphics.forEach(graphic => graphic.destroy());
    ship.setOrigin(.5);
    onComplete();
  };
  for (let i = 0; i < 3; i++) {
    const ring = scene.add.graphics({ x, y }).setDepth(9);
    ring.lineStyle(2, 0xd5fff2, .85).strokeEllipse(0, 0, 45, 13);
    graphics.push(ring);
    tweens.push(scene.tweens.add({ targets: ring, scaleX: 2.5, scaleY: 2.5, alpha: 0, delay: i * 90, duration: 560, ease: 'Sine.easeOut' }));
  }
  const splash = scene.add.graphics({ x, y }).setDepth(11);
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI * (i + .5) / 6;
    splash.lineStyle(2, 0xe4fff7, .95).lineBetween(Math.cos(angle) * 17, -Math.sin(angle) * 5, Math.cos(angle) * 32, -Math.sin(angle) * 18);
  }
  graphics.push(splash);
  tweens.push(scene.tweens.add({ targets: splash, scaleX: 1.4, scaleY: 1.4, alpha: 0, duration: 240, ease: 'Quad.easeOut' }));
  tweens.push(scene.tweens.addCounter({ from: 0, to: 1, duration: 780, onUpdate: tween => {
    const t = tween.getValue() ?? 0;
    ship.setOrigin(.5, .5 + Math.sin(t * Math.PI * 3) * (1 - t) * 1.5 / ship.height);
  }, onComplete: stop }));
  return { stop };
}
