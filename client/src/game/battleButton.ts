type ButtonListener = (pointer: { id: number }, x: number, y: number, event: { stopPropagation(): void }) => void;

export function bindBattleButton(button: { on(event: string, listener: ButtonListener): unknown }, action: () => void): void {
  const pressed = new Set<number>();
  button.on('pointerdown', (pointer, _x, _y, event) => {
    pressed.add(pointer.id);
    event.stopPropagation();
  });
  button.on('pointerout', pointer => pressed.delete(pointer.id));
  button.on('pointerup', (pointer, _x, _y, event) => {
    if (!pressed.delete(pointer.id)) return;
    event.stopPropagation();
    action();
  });
}
