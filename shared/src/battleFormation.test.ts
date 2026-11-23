import { describe, expect, it } from 'vitest';
import { BATTLE_FIELD, TICK, battleGroupSlots, battleResult, createBattle, issueCommand, replayBattle, stepBattle, type BattleGroup, type BattleLog, type BattleState, type Formation } from './battle';
import { SHIP_TYPES } from './ships';
import type { Ship, ShipType } from './types';

const ship = (id: number, type: ShipType = 'warship'): Ship => ({ ...SHIP_TYPES[type], id, type, name: `Ship ${id}`, durability: SHIP_TYPES[type].maxDurability, cargo: {} });
const setup = () => ({ seed: 42, attackers: [ship(1), ship(2, 'cargo'), ship(3, 'explorer'), ship(4), ship(5, 'explorer')], defenders: [ship(20)] });
const members = (b: BattleState) => b.ships.filter(s => s.side === 'attacker');
const errors = (b: BattleState, group: BattleGroup) => battleGroupSlots(b, group).map(slot => {
  const s = b.ships.find(s => s.side === group.side && s.id === slot.shipId)!;
  return Math.hypot(s.x - slot.x, s.y - slot.y);
});
function aligned(formation: Formation, count = 5) {
  const initial = setup(); initial.attackers = initial.attackers.slice(0, count);
  const b = createBattle(initial);
  for (const s of b.ships) { s.firepower = 0; s.order = { type: 'move', x: s.x, y: s.y }; }
  const leader = b.ships[0]; leader.x = 900; leader.y = BATTLE_FIELD.height / 2;
  issueCommand(b, 'attacker', { type: 'move', shipIds: members(b).map(s => s.id), x: 1800, y: leader.y, formation });
  for (const slot of battleGroupSlots(b, b.groups[0])) Object.assign(b.ships.find(s => s.id === slot.shipId)!, { x: slot.x, y: slot.y });
  return b;
}

describe('persistent battle formations', () => {
  it('assigns lateral slots by position with id ties, independent of fleet array order', () => {
    const b = createBattle(setup());
    const ys = [675, 600, 600, 100, 900];
    members(b).forEach((s, i) => { s.y = ys[i]; });
    const reversed = JSON.parse(JSON.stringify(b)) as BattleState;
    reversed.ships.reverse();
    for (const battle of [b, reversed]) issueCommand(battle, 'attacker', { type: 'free', shipIds: [1, 2, 3, 4, 5], formation: 'line' });
    const slots = battleGroupSlots(b, b.groups[0]);
    expect(slots[0].shipId).toBe(1);
    expect(slots.slice(1).sort((a, b) => a.y - b.y).map(s => s.shipId)).toEqual([4, 2, 3, 5]);
    expect(battleGroupSlots(reversed, reversed.groups[0])).toEqual(slots);
  });

  it('lets forming group mates pass through one another while moving straight to slots', () => {
    const b = aligned('line', 2);
    const [leader, follower] = members(b);
    follower.x = leader.x; follower.y = leader.y;
    stepBattle(b);
    const slot = battleGroupSlots(b, b.groups[0]).find(s => s.shipId === follower.id)!;
    expect(follower.x).toBe(leader.x);
    expect(follower.y).toBeGreaterThan(leader.y);
    expect(Math.hypot(follower.x - leader.x, follower.y - leader.y)).toBeLessThan(10);
    expect(follower.vx * (slot.y - follower.y) - follower.vy * (slot.x - follower.x)).toBeCloseTo(0);
  });

  it.each(['line', 'column', 'spread'] as const)('forms a %s from the real spawn without ships blocking each other', formation => {
    const initial = setup();
    initial.attackers[1].signature = true;
    const b = createBattle(initial);
    for (const s of b.ships) { s.firepower = 0; s.order = { type: 'move', x: s.x, y: s.y }; }
    issueCommand(b, 'attacker', { type: 'move', shipIds: members(b).map(s => s.id), x: 1800, y: 675, formation });
    for (let i = 0; i < 1000; i++) stepBattle(b);
    expect(Math.max(...errors(b, b.groups[0]))).toBeLessThan(1);
    expect(b.ships.find(s => s.id === b.groups[0].leaderId)!.x).toBeGreaterThan(1000);
  });

  it.each(['line', 'column', 'spread'] as const)('holds a mixed-speed %s across the field and on arrival', formation => {
    const b = aligned(formation), group = b.groups[0];
    const slowest = Math.min(...members(b).map(s => s.speed)) * 16;
    let movingTicks = 0;
    for (let i = 0; i < 600; i++) {
      stepBattle(b);
      expect(Math.max(...errors(b, group))).toBeLessThan(1);
      for (const s of members(b)) expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(s.speed * 16 + .001);
      const leader = b.ships.find(s => s.id === group.leaderId)!;
      if (leader.vx > 0) { movingTicks++; expect(Math.hypot(leader.vx, leader.vy)).toBeCloseTo(slowest); }
    }
    expect(movingTicks).toBeGreaterThan(300);
    const leader = b.ships.find(s => s.id === group.leaderId)!;
    expect(leader.x).toBeCloseTo(1800);
    expect(leader.heading).toBe(0);
    expect(leader.vx).toBe(0);
  });

  it('waits for a slow member to form up before advancing at fleet speed', () => {
    const b = aligned('line'), group = b.groups[0];
    const slow = b.ships.find(s => s.type === 'cargo')!;
    slow.x -= 80;
    const start = b.ships[0].x;
    stepBattle(b);
    expect(b.ships[0].x).toBe(start);
    for (let i = 0; i < 200; i++) stepBattle(b);
    expect(Math.max(...errors(b, group))).toBeLessThan(1);
    expect(b.ships[0].x).toBeGreaterThan(start + 200);
  });

  it('turns as a group for a broadside, holds slots and keeps firing', () => {
    const b = aligned('line', 3);
    for (const s of members(b)) { s.type = 'warship'; s.firepower = 2; }
    const target = b.ships.find(s => s.side === 'defender')!;
    target.x = 1600; target.y = BATTLE_FIELD.height / 2; target.durability = 100000;
    target.order = { type: 'move', x: target.x, y: target.y };
    issueCommand(b, 'attacker', { type: 'attack', shipIds: members(b).map(s => s.id), targetId: target.id, formation: 'line' });
    let shots = 0;
    for (let i = 0; i < 500; i++) {
      stepBattle(b);
      expect(Math.max(...errors(b, b.groups[0]))).toBeLessThan(1);
      shots += members(b).filter(s => s.reload === 3).length;
    }
    const group = b.groups[0];
    expect(group.order.type).toBe('attack');
    expect(Math.abs(group.heading)).toBeCloseTo(90);
    expect(Math.max(...errors(b, group))).toBeLessThan(1);
    expect(shots).toBeGreaterThan(5);
    expect(target.durability).toBeLessThan(100000);
  });

  it('holds instead of pursuing another enemy after its ordered target sinks', () => {
    const b = aligned('column');
    const target = b.ships.find(s => s.side === 'defender')!;
    b.ships.push({ ...target, id: 21, x: 2200, maxDurability: 200, durability: 200 }, { ...target, id: 22, x: 2300, maxDurability: 200, durability: 200 });
    issueCommand(b, 'attacker', { type: 'attack', shipIds: members(b).map(s => s.id), targetId: target.id, formation: 'column' });
    target.sunk = true; target.durability = 0;
    stepBattle(b);
    const group = b.groups[0], leader = b.ships.find(s => s.id === group.leaderId)!;
    const held = { x: leader.x, y: leader.y, heading: group.heading };
    for (let i = 0; i < 100; i++) stepBattle(b);
    expect(group.order).toEqual({ type: 'free' });
    expect(leader).toMatchObject({ x: held.x, y: held.y });
    expect(group.heading).toBe(held.heading);
  });

  it('detaches individual orders without dissolving the remaining formation', () => {
    const b = aligned('line'), id = b.groups[0].id;
    issueCommand(b, 'attacker', { type: 'move', shipIds: [3], x: 700, y: 200 });
    expect(b.ships.find(s => s.id === 3)!.groupId).toBeUndefined();
    expect(b.groups[0].id).toBe(id);
    expect(b.groups[0].shipIds).not.toContain(3);
    for (let i = 0; i < 400; i++) stepBattle(b);
    expect(Math.max(...errors(b, b.groups[0]))).toBeLessThan(1);
    expect(b.ships.find(s => s.id === 3)!.order).toEqual({ type: 'move', x: 700, y: 200 });
  });

  it('re-slots after sinking and chooses a new group leader by the flagship rule', () => {
    const b = aligned('line');
    issueCommand(b, 'attacker', { type: 'free', shipIds: [2, 3, 4], formation: 'line' });
    const group = b.groups.find(g => g.shipIds.includes(2))!;
    expect(group.leaderId).toBe(4);
    const lost = b.ships.find(s => s.id === 4)!;
    lost.sunk = true; lost.durability = 0;
    stepBattle(b);
    expect(group.leaderId).toBe(2);
    expect(group.shipIds).toEqual([2, 3]);
    expect(lost.groupId).toBeUndefined();
    for (let i = 0; i < 400; i++) stepBattle(b);
    expect(Math.max(...errors(b, group))).toBeLessThan(12);
    issueCommand(b, 'attacker', { type: 'free', shipIds: [3] });
    expect(b.groups.some(g => g.id === group.id)).toBe(false);
    expect(b.ships.find(s => s.id === 2)!.groupId).toBeUndefined();
  });

  it('uses signature, maximum durability, then id to elect the leader', () => {
    const b = aligned('spread');
    b.ships.find(s => s.id === 3)!.signature = true;
    issueCommand(b, 'attacker', { type: 'free', shipIds: [1, 2, 3, 4, 5] });
    expect(b.groups[0].leaderId).toBe(3);
    expect(b.groups[0].formation).toBe('spread');
    b.ships.find(s => s.id === 3)!.signature = false;
    issueCommand(b, 'attacker', { type: 'free', shipIds: [4, 2, 1] });
    expect(b.groups.find(g => g.shipIds.includes(1))!.leaderId).toBe(1);
  });

  it('ignores empty or invalid commands without changing group membership', () => {
    const b = aligned('line'), snapshot = JSON.stringify(b);
    issueCommand(b, 'attacker', { type: 'free', shipIds: [] });
    issueCommand(b, 'attacker', { type: 'move', shipIds: [1, 2], x: NaN, y: 0 });
    issueCommand(b, 'attacker', { type: 'attack', shipIds: [1, 2], targetId: -1 });
    issueCommand(b, 'defender', { type: 'free', shipIds: [1, 2] });
    expect(JSON.stringify(b)).toBe(snapshot);
  });

  it.each(['easy', 'normal', 'hard'] as const)('keeps the %s AI fleet grouped while preserving difficulty behaviour', difficulty => {
    const b = aligned('line');
    for (let i = 0; i < 100; i++) stepBattle(b, { attacker: difficulty });
    const group = b.groups.find(g => g.side === 'attacker')!;
    expect(group.formation).toBe('line');
    expect(group.shipIds).toHaveLength(difficulty === 'hard' ? 4 : 5);
    expect(members(b).filter(s => s.groupId === group.id).every(s => s.charge === (difficulty === 'easy'))).toBe(true);
    if (difficulty !== 'hard') expect(Math.max(...errors(b, group))).toBeLessThan(1);
    if (difficulty === 'hard') expect(b.ships.find(s => s.type === 'cargo')!.groupId).toBeUndefined();
  });

  it('replays group orders, reformations and detachments exactly after JSON restoration', () => {
    const initial = setup();
    const ids = initial.attackers.map(s => s.id);
    const log: BattleLog = [
      { tick: 0, side: 'attacker', cmd: { type: 'move', shipIds: ids, x: 1400, y: 675, formation: 'line' } },
      { tick: 150, side: 'attacker', cmd: { type: 'attack', shipIds: ids, targetId: 20, formation: 'column' } },
      { tick: 300, side: 'attacker', cmd: { type: 'move', shipIds: [3], x: 1000, y: 300 } },
      { tick: 400, side: 'attacker', cmd: { type: 'free', shipIds: [1, 2, 4, 5], formation: 'spread' } },
    ];
    let b = createBattle(initial);
    while (!b.outcome) {
      for (const entry of log.filter(e => e.tick === b.tick)) issueCommand(b, entry.side, entry.cmd);
      stepBattle(b, { defender: 'normal' });
      if (b.tick === 250) b = JSON.parse(JSON.stringify(b));
    }
    expect(replayBattle(initial, log, { defender: 'normal' })).toEqual(battleResult(b));
    expect(b.tick).toBeLessThanOrEqual(90 / TICK);
  });
});
