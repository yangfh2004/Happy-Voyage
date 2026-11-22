import { describe, expect, it } from 'vitest';
import { battleAI, battleResult, createBattle, inBroadsideArc, issueCommand, replayBattle, stepBattle, type BattleLog, type BattleSetup, type BattleState } from './battle';
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
  it('gates both broadsides, including the boundary angles', () => {
    const s = { x: 0, y: 0, heading: 0 };
    for (const degrees of [0, 29, 151, 180, -29, -151]) expect(inBroadsideArc(s, { x: Math.cos(degrees * Math.PI / 180), y: Math.sin(degrees * Math.PI / 180) })).toBe(false);
    for (const degrees of [31, 90, 149, -31, -90, -149]) expect(inBroadsideArc(s, { x: Math.cos(degrees * Math.PI / 180), y: Math.sin(degrees * Math.PI / 180) })).toBe(true);
    expect(inBroadsideArc(s, { x: 0, y: 1 })).toBe(true);
  });

  it('hits a stationary hull but a target can dodge after the shot', () => {
    const stationary = createBattle(setup());
    close(stationary);
    stationary.ships[1].firepower = 0;
    stepBattle(stationary);
    const dodging: BattleState = JSON.parse(JSON.stringify(stationary));
    dodging.ships[1].heading = 90;
    issueCommand(dodging, 'defender', { type: 'move', shipIds: [2], x: 850, y: 850 });
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
    while (ordinary.tick < 160) { stepBattle(ordinary); expect(ordinary.cannonballs.every((b) => b.side === 'attacker')).toBe(true); }
    stepBattle(ordinary);
    expect(ordinary.cannonballs.some((b) => b.side === 'defender')).toBe(true);
  });

  it('draws at 90 seconds or when all attackers retreat', () => {
    const b = createBattle(setup());
    for (const s of b.ships) s.firepower = 0;
    while (!b.outcome) stepBattle(b);
    expect(battleResult(b)).toMatchObject({ outcome: 'draw', ticks: 1800 });
    const retreat = createBattle(setup());
    issueCommand(retreat, 'attacker', { type: 'retreat' });
    while (!retreat.outcome) stepBattle(retreat);
    expect(retreat.outcome).toBe('draw');
    expect(retreat.tick).toBeLessThan(1800);
    expect(retreat.ships[0].escaped).toBe(true);
  });

  it('ignores invalid orders and rejects unfinished results', () => {
    const b = createBattle(setup());
    expect(() => battleResult(b)).toThrow('Battle is not finished');
    issueCommand(b, 'defender', { type: 'retreat' });
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
    const log: BattleLog = [{ tick: 0, side: 'attacker', cmd: { type: 'move', shipIds: [1], x: 900, y: 200 } },
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
