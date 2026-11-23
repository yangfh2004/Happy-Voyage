import { battleGroupSlots, type BattleSide, type BattleState } from '@happy-voyage/shared';

export const MOVE_MARKER_SECONDS = 1.5;

export function selectionPulse(clock: number, id: number) {
  const wave = (Math.sin(clock * 4 + id * .4) + 1) / 2;
  return { alpha: .72 + wave * .28, scale: 1 + wave * .09, bob: Math.sin(clock * 4 + id * .4) * 3 };
}

export function destinationSlots(battle: BattleState, side: BattleSide, shipIds: number[], goal: { x: number; y: number }) {
  const group = battle.groups.find(g => g.side === side && g.shipIds.length === shipIds.length && g.shipIds.every(id => shipIds.includes(id)));
  if (!group) return [{ ...goal }];
  const leader = battle.ships.find(s => s.side === side && s.id === group.leaderId)!;
  const heading = Math.atan2(goal.y - leader.y, goal.x - leader.x);
  const turn = heading - group.heading * Math.PI / 180, cos = Math.cos(turn), sin = Math.sin(turn);
  return battleGroupSlots(battle, group).map(slot => {
    const x = slot.x - leader.x, y = slot.y - leader.y;
    return { x: goal.x + x * cos - y * sin, y: goal.y + x * sin + y * cos };
  });
}

export function markerAlpha(clock: number, created: number) {
  return Math.max(0, Math.min(1, (MOVE_MARKER_SECONDS - (clock - created)) / .4));
}
