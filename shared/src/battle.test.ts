import { describe, expect, it } from 'vitest';
import { BATTLE_FIELD, BATTLE_STATS, TICK, battleAI, battleGroupSlots, battleResult, createBattle, inBroadsideArc, issueCommand, replayBattle, stepBattle, type BattleLog, type BattleSetup, type BattleState } from './battle';
import { SHIP_TYPES } from './ships';
import type { Ship } from './types';

const ship = (id: number): Ship => ({ ...SHIP_TYPES.warship, id, name: `Ship ${id}`, type: 'warship', cargo: {}, durability: 100 });
const setup = (): BattleSetup => ({ seed: 123, attackers: [ship(1)], defenders: [ship(2)] });
function close(b: BattleState) {
  b.ships[0].x = 600;
  b.ships[1].x = 850;
  for (const s of b.ships) { s.heading = 90; s.order = { type: 'move', x: s.x, y: s.y }; }
}

describe('real-time battle', () => {
  it('scales spawn lines and rows to the expanded field without enlarging collision radii', () => {
    const b = createBattle({ seed: 1, attackers: Array.from({ length: 8 }, (_, i) => ship(i)), defenders: [ship(20)] });
    expect(BATTLE_FIELD).toEqual({ width: 2400, height: 1350 });
    expect(b.ships[0].x).toBe(BATTLE_FIELD.width * .1);
    expect(b.ships[8].x).toBe(BATTLE_FIELD.width * .9);
    expect(b.ships[8].y).toBe(BATTLE_FIELD.height / 2);
    expect(b.ships[1].y - b.ships[0].y).toBe(174);
    expect(b.ships[7].x - b.ships[0].x).toBe(174);
    expect(Object.values(BATTLE_STATS).map(s => s.radius)).toEqual([22, 20, 16]);
  });

  it.each([['warship', 640, .8], ['cargo', 440, .55], ['explorer', 520, .65]] as const)('fires %s at its doubled range with unchanged maximum flight time', (type, range, flight) => {
    for (const gap of [range, range + 1]) {
      const b = createBattle(setup());
      const [a, d] = b.ships;
      Object.assign(a, SHIP_TYPES[type], { type, x: BATTLE_FIELD.width / 3, heading: 90 });
      d.x = a.x + gap;
      for (const s of b.ships) { s.speed = 0; s.order = { type: 'move', x: s.x, y: s.y }; }
      stepBattle(b);
      const ball = b.cannonballs.find(ball => ball.side === 'attacker');
      expect(BATTLE_STATS[type].range).toBe(range);
      if (gap > range) expect(ball).toBeUndefined();
      else {
        expect(ball).toBeDefined();
        expect(ball!.remaining + TICK).toBeCloseTo(flight, 1);
      }
    }
  });

  it.each(['warship', 'cargo', 'explorer'] as const)('uses %s range for AI and commanded approach stops, and moves at speed times 16', (type) => {
    for (const controlled of [false, true]) for (const ratio of [.79, .81]) {
      const b = createBattle(setup());
      const [a, d] = b.ships;
      Object.assign(a, SHIP_TYPES[type], { type, x: BATTLE_FIELD.width / 3, heading: 0 });
      d.x = a.x + BATTLE_STATS[type].range * ratio;
      d.speed = 0;
      if (!controlled) issueCommand(b, 'attacker', { type: 'attack', shipIds: [a.id], targetId: d.id });
      const x = a.x;
      stepBattle(b, controlled ? { attacker: 'normal' } : {});
      expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(ratio < .8 ? 0 : SHIP_TYPES[type].speed * 16);
      expect(a.x - x).toBeCloseTo(ratio < .8 ? 0 : SHIP_TYPES[type].speed * 16 * TICK);
    }
  });

  it.each(['easy', 'normal', 'hard'] as const)('keeps both fleets separated throughout a full %s AI battle', (difficulty) => {
    const fleet = (start: number) => Array.from({ length: 7 }, (_, i) => {
      const type = (['warship', 'explorer', 'cargo'] as const)[i % 3];
      return { ...ship(start + i), ...SHIP_TYPES[type], type };
    });
    const initial = { seed: 42, attackers: fleet(1), defenders: fleet(20) };
    const battle = createBattle(initial);
    let worstOverlap = 0;
    while (!battle.outcome) {
      stepBattle(battle, { attacker: difficulty, defender: difficulty });
      const live = battle.ships.filter((s) => !s.sunk && !s.escaped);
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        worstOverlap = Math.max(worstOverlap, BATTLE_STATS[a.type].radius + BATTLE_STATS[b.type].radius + 64 - Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    expect(worstOverlap).toBeLessThan(2);
    expect(battleResult(battle)).toEqual(replayBattle(initial, [], { attacker: difficulty, defender: difficulty }));
  });

  it.each(['column', 'line', 'spread'] as const)('spaces %s slots using the B1 spacing', (formation) => {
    const battle = createBattle({ seed: 1, attackers: Array.from({ length: 7 }, (_, i) => ship(i)), defenders: [ship(20)] });
    issueCommand(battle, 'attacker', { type: 'move', shipIds: battle.ships.map((s) => s.id), x: 0, y: BATTLE_FIELD.height, formation });
    const targets = battleGroupSlots(battle, battle.groups[0]);
    for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i], b = targets[j];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(198 - .001);
    }
  });

  it('separates coincident allies and enemies at an edge without moving sunk hulls', () => {
    const battle = createBattle({ seed: 1, attackers: [ship(1), ship(2), ship(3)], defenders: [ship(4), ship(5)] });
    for (const s of battle.ships) { s.x = 54; s.y = 54; s.speed = 0; s.firepower = 0; }
    battle.ships[4].sunk = true;
    stepBattle(battle);
    const live = battle.ships.filter((s) => !s.sunk);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) expect(Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y)).toBeGreaterThan(106);
    expect(battle.ships[4]).toMatchObject({ x: 54, y: 54 });
    issueCommand(battle, 'attacker', { type: 'move', shipIds: [], x: 0, y: 0 });
    expect(battle.ships[0].order).toEqual({ type: 'free' });
  });

  it('spaces separately issued move targets and leaves an empty selection alone', () => {
    const battle = createBattle({ seed: 1, attackers: [ship(1), ship(2)], defenders: [ship(3)] });
    for (const id of [1, 2]) issueCommand(battle, 'attacker', { type: 'move', shipIds: [id], x: 500, y: 500 });
    const [a, b] = battle.ships.map((s) => s.order);
    if (a.type !== 'move' || b.type !== 'move') throw new Error('Missing move order');
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(130);
    const before = JSON.stringify(battle);
    issueCommand(battle, 'attacker', { type: 'move', shipIds: [], x: 500, y: 500 });
    expect(JSON.stringify(battle)).toBe(before);
  });

  it('gates both broadsides, including the boundary angles', () => {
    const s = { x: 0, y: 0, heading: 0 };
    for (const degrees of [0, 29, 151, 180, -29, -151]) expect(inBroadsideArc(s, { x: Math.cos(degrees * Math.PI / 180), y: Math.sin(degrees * Math.PI / 180) })).toBe(false);
    for (const degrees of [31, 90, 149, -31, -90, -149]) expect(inBroadsideArc(s, { x: Math.cos(degrees * Math.PI / 180), y: Math.sin(degrees * Math.PI / 180) })).toBe(true);
    expect(inBroadsideArc(s, { x: 0, y: 1 })).toBe(true);
  });

  it('hits a stationary hull but a target can dodge after the shot', () => {
    const stationary = createBattle(setup());
    close(stationary);
    stationary.ships[1].x = stationary.ships[0].x + BATTLE_STATS.warship.range * .9;
    stationary.ships[1].order = { type: 'move', x: stationary.ships[1].x, y: stationary.ships[1].y };
    stationary.ships[1].firepower = 0;
    stepBattle(stationary);
    const dodging: BattleState = JSON.parse(JSON.stringify(stationary));
    dodging.ships[1].heading = 90;
    issueCommand(dodging, 'defender', { type: 'move', shipIds: [2], x: dodging.ships[1].x, y: BATTLE_FIELD.height * .9 });
    for (let i = 0; i < 20; i++) { stepBattle(stationary); stepBattle(dodging); }
    expect(stationary.ships[1].durability).toBeLessThan(100);
    expect(dodging.ships[1].durability).toBe(100);
  });

  it('suppresses defense for eight seconds and multiplies Inspire damage', () => {
    const ordinary = createBattle({ ...setup(), ambush: true });
    close(ordinary);
    const inspired: BattleState = JSON.parse(JSON.stringify(ordinary));
    inspired.attackerMultiplier = 1.5;
    stepBattle(ordinary);
    stepBattle(inspired);
    expect(ordinary.cannonballs.every((b) => b.side === 'attacker')).toBe(true);
    expect(Math.abs(inspired.cannonballs[0].damage - ordinary.cannonballs[0].damage * 1.5)).toBeLessThanOrEqual(1);
    ordinary.ships[0].firepower = 0;
    ordinary.ships[1].durability = 10000;
    while (ordinary.tick < 8 / TICK) { stepBattle(ordinary); expect(ordinary.cannonballs.every((b) => b.side === 'attacker')).toBe(true); }
    stepBattle(ordinary);
    expect(ordinary.cannonballs.some((b) => b.side === 'defender')).toBe(true);
  });

  it('draws at 90 seconds but concedes defeat when attackers retreat', () => {
    const b = createBattle(setup());
    for (const s of b.ships) s.firepower = 0;
    while (!b.outcome) stepBattle(b);
    expect(battleResult(b)).toMatchObject({ outcome: 'draw', ticks: 1800 });
    const retreat = createBattle(setup());
    issueCommand(retreat, 'attacker', { type: 'retreat' });
    while (!retreat.outcome) stepBattle(retreat);
    expect(retreat.outcome).toBe('defeat');
    expect(retreat.tick).toBeLessThan(1800);
    expect(retreat.ships[0].durability).toBe(100);
  });

  it('ignores invalid orders and rejects unfinished results', () => {
    const b = createBattle(setup());
    expect(() => battleResult(b)).toThrow('Battle is not finished');
    issueCommand(b, 'defender', { type: 'move', shipIds: [1], x: 300, y: 300 });
    issueCommand(b, 'attacker', { type: 'attack', shipIds: [1], targetId: 1 });
    issueCommand(b, 'attacker', { type: 'move', shipIds: [1], x: NaN, y: 300 });
    b.ships[0].sunk = true;
    issueCommand(b, 'attacker', { type: 'move', shipIds: [1], x: 300, y: 300 });
    expect(b.ships[0].order).toEqual({ type: 'free' });
    expect(b.retreating).toBe(false);
    expect(replayBattle({ seed: 0, attackers: [], defenders: [] }, [])).toMatchObject({ outcome: 'defeat', attackerSunk: [], defenderSunk: [] });
  });

  it('replays the same seed and log identically to live stepping and survives JSON round trips', () => {
    const initial = setup();
    const log: BattleLog = [{ tick: 0, side: 'attacker', cmd: { type: 'move', shipIds: [1], x: BATTLE_FIELD.width * .6, y: BATTLE_FIELD.height / 2 } },
      { tick: 100, side: 'attacker', cmd: { type: 'free', shipIds: [1] } }];
    let live = createBattle(initial);
    while (!live.outcome) {
      for (const entry of log.filter((e) => e.tick === live.tick)) issueCommand(live, entry.side, entry.cmd);
      stepBattle(live, { defender: 'normal' });
      if (live.tick === 90) live = JSON.parse(JSON.stringify(live));
    }
    const result = replayBattle(initial, log, { defender: 'normal' });
    expect(result).toEqual(battleResult(live));
    expect(replayBattle(initial, log, { defender: 'normal' })).toEqual(result);
  });

  it.each(['easy', 'normal', 'hard'] as const)('finishes AI vs AI on %s', (difficulty) => {
    const b = createBattle(setup());
    while (!b.outcome) stepBattle(b, { attacker: difficulty, defender: difficulty });
    expect(b.tick).toBeLessThanOrEqual(1800);
    expect(b.outcome).not.toBeNull();
  });

  it('hard AI retreats when outmatched and only re-decides once per second', () => {
    const b = createBattle(setup());
    b.ships[0].durability = 20;
    b.tick = 1;
    battleAI(b, 'attacker', 'hard');
    expect(b.retreating).toBe(false);
    b.tick = 20;
    battleAI(b, 'attacker', 'hard');
    expect(b.retreating).toBe(true);
  });
});
