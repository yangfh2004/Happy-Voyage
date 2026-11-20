import type { GameController } from './GameController';

export function keyboardShortcuts(controller: GameController) {
  const held = new Set<string>();
  const finishVisit = () => {
    if (controller.state?.phase === 'awaitingCargoMarket') controller.finishTrading();
    else controller.finishBuilding();
  };
  const actions: Record<string, () => void> = {
    ' ': () => controller.state?.phase === 'gameOver' ? controller.quit() : controller.spinCompass(),
    enter: () => controller.state?.phase === 'gameOver' ? controller.quit() : controller.spinCompass(),
    c: () => controller.claim(),
    s: () => controller.decline(),
    escape: () => {
      const phase = controller.state?.phase;
      if (phase === 'awaitingBuild' || phase === 'awaitingCargoMarket') finishVisit();
      else controller.decline();
    },
    d: finishVisit,
    p: () => controller.payToll(),
    f: () => controller.fight(),
    k: () => controller.skipToMyTurn(),
    '1': () => controller.setSpeed('Normal'),
    '2': () => controller.setSpeed('Fast'),
    '3': () => controller.setSpeed('Instant'),
  };
  return {
    keydown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      const key = event.key.toLowerCase();
      if ((key === ' ' || key === 'enter') && target?.closest?.('button, a[href], summary, [tabindex], [role="button"], [role="link"]')) return;
      const action = actions[key];
      if (!action) return;
      if (!controller.state && !['1', '2', '3'].includes(key) && !held.has(key) && !event.repeat) return;
      event.preventDefault();
      if (event.repeat || held.has(key)) return;
      held.add(key);
      action();
    },
    keyup(event: KeyboardEvent) { held.delete(event.key.toLowerCase()); },
    blur() { held.clear(); },
  };
}
