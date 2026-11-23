import { describe, expect, it } from 'vitest';
import { createBattle, issueCommand, SHIP_TYPES, type Ship } from '@happy-voyage/shared';
import { destinationSlots, markerAlpha, MOVE_MARKER_SECONDS, selectionPulse } from './battleSelection';

const ship = (id: number): Ship => ({ ...SHIP_TYPES.warship, id, type: 'warship', durability: 120, cargo: {}, name: 'Ship' });

describe('battle selection cues', () => {
  it('pulses without disappearing and keeps the chevron bob small', () => {
    const values = Array.from({ length: 100 }, (_, i) => selectionPulse(i / 20, 1));
    expect(Math.max(...values.map(v => v.alpha)) - Math.min(...values.map(v => v.alpha))).toBeGreaterThan(.2);
    for (const v of values) {
      expect(v.alpha).toBeGreaterThanOrEqual(.7);
      expect(v.scale).toBeGreaterThanOrEqual(1);
      expect(v.scale).toBeLessThanOrEqual(1.1);
      expect(Math.abs(v.bob)).toBeLessThanOrEqual(3);
    }
  });

  it.each(['line', 'column', 'spread'] as const)('previews rotated %s slots at the destination without mutating the simulation', formation => {
    const b = createBattle({ seed: 1, attackers: [ship(1), ship(2), ship(3)], defenders: [ship(4)] });
    const goal = { x: b.ships[0].x, y: b.ships[0].y + 500 };
    issueCommand(b, 'attacker', { type: 'move', shipIds: [1, 2, 3], ...goal, formation });
    const before = JSON.stringify(b);
    const dots = destinationSlots(b, 'attacker', [1, 2, 3], goal);
    expect(dots).toHaveLength(3);
    expect(dots[0]).toEqual(goal);
    expect(Math.hypot(dots[0].x - dots[1].x, dots[0].y - dots[1].y)).toBeCloseTo(198);
    if (formation === 'column') expect(dots[1].y).toBeLessThan(goal.y);
    if (formation === 'line') expect(dots[1].x).not.toBe(goal.x);
    expect(JSON.stringify(b)).toBe(before);
  });

  it('uses just the clicked point for empty, individual or unmatched selections', () => {
    const b = createBattle({ seed: 1, attackers: [ship(1)], defenders: [ship(2)] });
    for (const ids of [[], [1], [999]]) expect(destinationSlots(b, 'attacker', ids, { x: 10, y: 20 })).toEqual([{ x: 10, y: 20 }]);
  });

  it('fades and expires the destination after 1.5 seconds', () => {
    expect(MOVE_MARKER_SECONDS).toBe(1.5);
    expect(markerAlpha(10, 10)).toBe(1);
    expect(markerAlpha(11.3, 10)).toBeCloseTo(.5);
    expect(markerAlpha(11.5, 10)).toBe(0);
    expect(markerAlpha(12, 10)).toBe(0);
  });
});
