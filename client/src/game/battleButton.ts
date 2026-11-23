import type Phaser from 'phaser';

export function bindBattleButton(button: Pick<Phaser.GameObjects.Text, 'on'>, action: () => void): void {
  const pressed = new Set<number>();
  button.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    pressed.add(pointer.id);
    event.stopPropagation();
  });
  button.on('pointerout', (pointer: Phaser.Input.Pointer) => pressed.delete(pointer.id));
  button.on('pointerup', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    if (!pressed.delete(pointer.id)) return;
    event.stopPropagation();
    action();
  });
}
