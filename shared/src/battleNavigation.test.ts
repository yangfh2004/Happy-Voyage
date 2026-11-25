import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { BATTLE_FIELD, BATTLE_STATS, battleGroupSlots, createBattle, issueCommand, stepBattle, type BattleSide, type BattleState, type Formation } from './battle';
import { SHIP_TYPES } from './ships';
import type { ShipType } from './types';
import { NAVIGATORS, type NavigatorId } from './navigators';

function spainBattle(): BattleState {
  const engine = new GameEngine({ players: [{ name: 'Spain', color: 0, isAI: false, navigator: 'columbus' }, { name: 'AI', color: 1, isAI: true }], rng: () => .5 });
  const b = createBattle({ seed: 42, attackers: engine.state.players[0].fleet, defenders: [engine.state.players[1].fleet[0]] });
  for (const s of b.ships) {
    s.firepower = 0;
    if (s.side === 'defender') { s.x = BATTLE_FIELD.width - 50; s.y = BATTLE_FIELD.height - 50; }
    s.order = { type: 'move', x: s.x, y: s.y };
  }
  return b;
}

describe('formation navigation regressions', () => {
  it('keeps every slot of a diagonal 26-ship spread reachable inside the field', () => {
    const { b, shipIds } = navigationBattle('attacker', 26, 'warship');
    issueCommand(b, 'attacker', { type: 'move', shipIds, x: BATTLE_FIELD.width, y: BATTLE_FIELD.height, formation: 'spread' });
    const group = b.groups[0], leader = b.ships.find(s => s.side === 'attacker' && s.id === group.leaderId)!;
    group.heading = 45;
    leader.x = BATTLE_FIELD.width / 2; leader.y = BATTLE_FIELD.height / 2;
    const slots = battleGroupSlots(b, group);
    expect(slots).toHaveLength(26);
    for (const slot of slots) {
      expect(slot.x).toBeGreaterThanOrEqual(54);
      expect(slot.x).toBeLessThanOrEqual(BATTLE_FIELD.width - 54);
      expect(slot.y).toBeGreaterThanOrEqual(54);
      expect(slot.y).toBeLessThanOrEqual(BATTLE_FIELD.height - 54);
    }
  });

  it('assembles the actual Spain starting fleet in Spread without pinning the warship behind its flagship', () => {
    const b = spainBattle();
    issueCommand(b, 'attacker', { type: 'free', shipIds: b.ships.filter(s => s.side === 'attacker').map(s => s.id), formation: 'spread' });
    for (let i = 0; i < 1799; i++) stepBattle(b);
    for (const slot of battleGroupSlots(b, b.groups[0])) {
      const s = b.ships.find(s => s.side === 'attacker' && s.id === slot.shipId)!;
      expect(Math.hypot(s.x - slot.x, s.y - slot.y), s.name).toBeLessThan(12);
    }
  });

  it('folds a 14-ship line into ranks instead of compressing below collision clearance', () => {
    const { b, shipIds } = navigationBattle('attacker', 14, 'warship');
    issueCommand(b, 'attacker', { type: 'move', shipIds, x: BATTLE_FIELD.width * 2 / 3, y: BATTLE_FIELD.height / 2, formation: 'line' });
    const slots = battleGroupSlots(b, b.groups[0]);
    for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
      expect(Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y)).toBeGreaterThanOrEqual(198 - .001);
    }
    expect(new Set(slots.map(s => s.x)).size).toBeGreaterThan(1);
  });

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

const destinations = [
  [0, 0], [BATTLE_FIELD.width, 0], [0, BATTLE_FIELD.height], [BATTLE_FIELD.width, BATTLE_FIELD.height],
  [0, BATTLE_FIELD.height / 2], [BATTLE_FIELD.width, BATTLE_FIELD.height / 2],
  [BATTLE_FIELD.width / 2, 0], [BATTLE_FIELD.width / 2, BATTLE_FIELD.height], [BATTLE_FIELD.width / 2, BATTLE_FIELD.height / 2],
  [BATTLE_FIELD.width * .75, BATTLE_FIELD.height * .25], [BATTLE_FIELD.width * .65, BATTLE_FIELD.height * .8],
];
const navigationCases = NAVIGATORS.filter(n => ['columbus', 'cook', 'magellan', 'morgan'].includes(n.id)).flatMap((navigator, n) =>
  (['attacker', 'defender'] as BattleSide[]).flatMap((side, s) =>
    (['column', 'line', 'spread'] as Formation[]).flatMap((formation, f) =>
      [2, 5, 10, 14, 26].map((count, c) => {
        const [x, y] = destinations[(c * 2 + f * 3 + n * 5 + s * 7) % destinations.length];
        const corner = [0, BATTLE_FIELD.width].some(cx => [0, BATTLE_FIELD.height].some(cy => Math.hypot(x - cx, y - cy) < 198));
        return { navigator: navigator.id, side, formation, count, x, y, tolerance: count <= 10 && !corner ? 12 : 396 };
      }))));

function navigatorBattle(navigator: NavigatorId, count: number, side: BattleSide) {
  const engine = new GameEngine({ players: [{ name: 'Navigator', color: 0, isAI: false, navigator }, { name: 'AI', color: 1, isAI: true }], rng: () => .5 });
  const base = engine.state.players[0].fleet;
  const fleet = count === 2 ? [base.find(s => s.signature)!, base.find(s => !s.signature)!] : base.slice(0, count);
  while (fleet.length < count) {
    const type = base[fleet.length % base.length].type;
    fleet.push({ ...SHIP_TYPES[type], id: fleet.length + 1, type, name: 'Extra ship', durability: SHIP_TYPES[type].maxDurability, cargo: {} });
  }
  const opponent = { ...base[0], id: 1000 };
  const b = createBattle({ seed: 42, attackers: side === 'attacker' ? fleet : [opponent], defenders: side === 'defender' ? fleet : [opponent] });
  for (const s of b.ships) s.firepower = 0;
  b.ships.find(s => s.side !== side)!.escaped = true;
  return { b, shipIds: fleet.map(s => s.id) };
}

function navigationBattle(side: BattleSide, count: number, type: ShipType = 'explorer') {
  const ships = Array.from({ length: count }, (_, i) => ({ ...SHIP_TYPES[type], id: i + 1, type, durability: SHIP_TYPES[type].maxDurability, name: 'Ship', cargo: {}, firepower: 0 }));
  const opponent = { ...ships[0], id: 1000 };
  const b = createBattle({ seed: 42, attackers: side === 'attacker' ? ships : [opponent], defenders: side === 'defender' ? ships : [opponent] });
  b.ships.find(s => s.side !== side)!.escaped = true;
  return { b, shipIds: ships.map(s => s.id) };
}

describe('formation no-stall matrix', () => {
  it('stops waiting after two seconds without follower progress and keeps retrying its slot', () => {
    const { b, shipIds } = navigationBattle('attacker', 2);
    const leader = b.ships.find(s => s.side === 'attacker')!;
    issueCommand(b, 'attacker', { type: 'move', shipIds, x: BATTLE_FIELD.width / 2, y: leader.y, formation: 'line' });
    for (const slot of battleGroupSlots(b, b.groups[0])) Object.assign(b.ships.find(s => s.side === 'attacker' && s.id === slot.shipId)!, { x: slot.x, y: slot.y });
    const follower = b.ships.find(s => s.side === 'attacker' && s !== leader)!;
    follower.x -= 80;
    const start = leader.x, blocked = { x: follower.x, y: follower.y };
    for (let i = 0; i < 41; i++) {
      Object.assign(follower, blocked);
      stepBattle(b);
      if (i < 40) expect(leader.x).toBe(start);
    }
    expect(leader.x).toBeGreaterThan(start);
    expect(Math.hypot(follower.vx, follower.vy)).toBeGreaterThan(0);
  });

  it('serializes and replays bounded formation recovery exactly', () => {
    const { b, shipIds } = navigationBattle('attacker', 14);
    issueCommand(b, 'attacker', { type: 'move', shipIds, x: BATTLE_FIELD.width, y: 0, formation: 'line' });
    while (b.tick < 600 && (b.groups[0].formingTicks ?? 0) < 60) stepBattle(b);
    expect(b.groups[0].formingTicks).toBe(60);
    const restored = JSON.parse(JSON.stringify(b)) as BattleState;
    const leader = b.ships.find(s => s.id === b.groups[0].leaderId)!, start = { x: leader.x, y: leader.y };
    for (let i = 0; i < 80; i++) { stepBattle(b); stepBattle(restored); }
    expect(b).toEqual(restored);
    expect(Math.hypot(leader.x - start.x, leader.y - start.y)).toBeGreaterThan(100);
  });

  it.each(navigationCases)('$navigator $side $formation with $count ships reaches ($x, $y)', ({ navigator, side, formation, count, x, y, tolerance }) => {
    const { b, shipIds } = navigatorBattle(navigator, count, side);
    issueCommand(b, side, { type: 'move', shipIds, x, y, formation });
    const group = b.groups[0], leader = b.ships.find(s => s.side === side && s.id === group.leaderId)!;
    let arrived = false;
    for (let i = 0; i < 1799; i++) {
      stepBattle(b);
      const slots = battleGroupSlots(b, group);
      expect(slots).toHaveLength(count);
      const offsets = slots.map(p => ({ x: p.x - slots[0].x, y: p.y - slots[0].y, radius: BATTLE_STATS[b.ships.find(s => s.side === side && s.id === p.shipId)!.type].radius + 32 }));
      const goalX = Math.max(Math.max(...offsets.map(p => p.radius - p.x)), Math.min(Math.min(...offsets.map(p => BATTLE_FIELD.width - p.radius - p.x)), x));
      const goalY = Math.max(Math.max(...offsets.map(p => p.radius - p.y)), Math.min(Math.min(...offsets.map(p => BATTLE_FIELD.height - p.radius - p.y)), y));
      const turn = (group.heading - group.moveHeading!) * Math.PI / 180;
      arrived = Math.hypot(leader.x - goalX, leader.y - goalY) < 2 && Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) < .001;
      if (arrived && slots.every(slot => Math.hypot(b.ships.find(s => s.side === side && s.id === slot.shipId)!.x - slot.x, b.ships.find(s => s.side === side && s.id === slot.shipId)!.y - slot.y) < tolerance)) break;
    }
    expect(arrived, JSON.stringify({ tick: b.tick, leader: { x: leader.x, y: leader.y }, heading: group.heading, goal: { x, y } })).toBe(true);
    for (const slot of battleGroupSlots(b, group)) {
      const s = b.ships.find(s => s.side === side && s.id === slot.shipId)!;
      const error = Math.hypot(s.x - slot.x, s.y - slot.y);
      expect(error, JSON.stringify({ navigator, side, formation, count, goal: { x, y }, shipId: s.id, tolerance })).toBeLessThan(tolerance);
    }
  });
});
