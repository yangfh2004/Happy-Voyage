import type Phaser from 'phaser';

export function stopHelpPosition(anchor: { x: number; y: number }, size: { width: number; height: number }, view: { x: number; y: number; width: number; height: number }, padding: number) {
  return {
    x: Math.max(view.x + padding + size.width / 2, Math.min(anchor.x, view.x + view.width - padding - size.width / 2)),
    y: Math.max(view.y + padding + size.height, Math.min(anchor.y, view.y + view.height - padding)),
  };
}

export function bindStopHelp(target: Pick<Phaser.GameObjects.GameObject, 'on'>, show: () => void, hide: () => void) {
  target.on('pointerover', (pointer: Phaser.Input.Pointer) => { if (!pointer.wasTouch) show(); });
  target.on('pointerout', (pointer: Phaser.Input.Pointer) => { if (!pointer.wasTouch) hide(); });
  target.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (pointer.wasTouch && pointer.getDistance() < 12) show();
  });
}
