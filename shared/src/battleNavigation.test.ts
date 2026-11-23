import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { BATTLE_STATS, battleGroupSlots, createBattle, issueCommand, stepBattle, type BattleState } from './battle';

function spainBattle(): BattleState {
  const engine = new GameEngine({ players: [{ name: 'Spain', color: 0, isAI: false, navigator: 'columbus' }, { name: 'AI', color: 1, isAI: true }], rng: () => .5 });
  const b = createBattle({ seed: 42, attackers: engine.state.players[0].fleet, defenders: [engine.state.players[1].fleet[0]] });
  for (const s of b.ships) {
    s.firepower = 0;
    if (s.side === 'defender') { s.x = 2350; s.y = 1300; }
    s.order = { type: 'move', x: s.x, y: s.y };
  }
  return b;
}

describe('formation navigation regressions', () => {
  it('turns an east-facing column toward a west-edge move instead of sailing east', () => {
    const b = spainBattle();
    const leader = b.ships.find(s => s.signature)!;
    const start = leader.x;
    issueCommand(b, 'attacker', { type: 'move', shipIds: b.ships.filter(s => s.side === 'attacker').map(s => s.id), x: 0, y: leader.y, formation: 'column' });
    for (let i = 0; i < 1799; i++) stepBattle(b);
    expect(leader.x).toBeLessThan(start);
    expect(Math.abs(leader.x - (BATTLE_STATS[leader.type].radius + 32))).toBeLessThan(1);
    expect(Math.abs(b.groups[0].heading)).toBeCloseTo(180);
  });

  it('does not strand Spain spread followers against the west wall on a diagonal move', () => {
    const b = spainBattle();
    issueCommand(b, 'attacker', { type: 'move', shipIds: b.ships.filter(s => s.side === 'attacker').map(s => s.id), x: 1300, y: 1200, formation: 'spread' });
    for (let i = 0; i < 1799; i++) stepBattle(b);
    const group = b.groups[0], leader = b.ships.find(s => s.id === group.leaderId)!;
    expect(leader.x).toBeGreaterThan(1200);
    for (const slot of battleGroupSlots(b, group)) {
      const s = b.ships.find(s => s.id === slot.shipId)!;
      const radius = BATTLE_STATS[s.type].radius + 32;
      expect(s.x).toBeGreaterThanOrEqual(radius);
      expect(s.y).toBeGreaterThanOrEqual(radius);
      expect(Math.hypot(s.x - slot.x, s.y - slot.y)).toBeLessThan(12);
    }
  });
});
