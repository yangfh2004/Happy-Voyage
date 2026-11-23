import { describe, expect, it } from 'vitest';
import { BATTLE_STATS, TICK, battleResult, broadsideBattery, createBattle, issueCommand, replayBattle, stepBattle, type BattleLog, type BattleSetup } from './battle';
import { SHIP_TYPES } from './ships';
import type { Ship } from './types';

const ship = (id: number): Ship => ({ ...SHIP_TYPES.warship, id, type: 'warship', name: `Ship ${id}`, durability: 120, cargo: {} });

function crossfire(extraTargets = false) {
  const b = createBattle({ seed: 123, attackers: [ship(1)], defenders: (extraTargets ? [2, 3, 4, 5] : [2, 3]).map(ship) });
  b.ships.forEach((s, i) => {
    s.x = 1200; s.y = [675, 375, 975, 525, 825][i]; s.heading = 0; s.speed = 0;
    s.order = { type: 'move', x: s.x, y: s.y };
    if (s.side === 'defender') s.firepower = 0;
  });
  return b;
}

describe('independent broadside batteries', () => {
  it('fires full-power port and starboard shots at their respective targets in the same tick', () => {
    const b = crossfire();
    stepBattle(b);
    const shots = b.cannonballs.filter(ball => ball.side === 'attacker');
    expect(shots.map(ball => ball.battery)).toEqual(['port', 'starboard']);
    expect(b.ships[0].reload).toEqual({ port: 3, starboard: 3 });
    for (const [i, shot] of shots.entries()) {
      const target = b.ships[i + 1];
      expect(shot.shipId).toBe(1);
      expect(Math.abs(shot.landingX - target.x)).toBeLessThanOrEqual(9);
      expect(Math.abs(shot.landingY - target.y)).toBeLessThanOrEqual(9);
      expect(Math.sign(shot.y - b.ships[0].y)).toBe(i === 0 ? -1 : 1);
      expect(shot.damage).toBeGreaterThanOrEqual(Math.round(b.ships[0].firepower * .75));
      expect(shot.damage).toBeLessThanOrEqual(Math.round(b.ships[0].firepower * 1.25));
    }
  });

  it('reloads each side independently without resetting the other battery', () => {
    const b = crossfire(), shooter = b.ships[0];
    shooter.reload.port = TICK * 2;
    stepBattle(b);
    expect(b.cannonballs.filter(ball => ball.shipId === 1).map(ball => ball.battery)).toEqual(['starboard']);
    expect(shooter.reload.port).toBeCloseTo(TICK);
    expect(shooter.reload.starboard).toBe(3);
    stepBattle(b);
    expect(b.cannonballs.filter(ball => ball.shipId === 1 && ball.battery === 'port')).toHaveLength(1);
    expect(shooter.reload.port).toBe(3);
    expect(shooter.reload.starboard).toBeCloseTo(3 - TICK);
  });

  it('prefers the ordered target only on its own side and otherwise fires at the nearest enemy', () => {
    const b = crossfire(true);
    issueCommand(b, 'attacker', { type: 'attack', shipIds: [1], targetId: 3 });
    stepBattle(b);
    const shots = b.cannonballs.filter(ball => ball.shipId === 1);
    expect(Math.abs(shots.find(ball => ball.battery === 'port')!.landingY - 525)).toBeLessThanOrEqual(9);
    expect(Math.abs(shots.find(ball => ball.battery === 'starboard')!.landingY - 975)).toBeLessThanOrEqual(9);
  });

  it('leaves an empty side ready instead of consuming its reload or RNG draws', () => {
    const b = crossfire();
    b.ships[1].escaped = true;
    b.ships[2].reload = { port: 10, starboard: 10 };
    stepBattle(b);
    expect(b.cannonballs.map(ball => ball.battery)).toEqual(['starboard']);
    expect(b.ships[0].reload).toEqual({ port: 0, starboard: 3 });
    expect(b.rng).toBe((123 + 3 * 0x6D2B79F5) >>> 0);
  });

  it('does not fire or advance RNG with no eligible enemies', () => {
    const b = crossfire();
    for (const s of b.ships.slice(1)) { s.x = 2300; s.order = { type: 'move', x: s.x, y: s.y }; }
    stepBattle(b);
    expect(b.cannonballs).toEqual([]);
    expect(b.ships[0].reload).toEqual({ port: 0, starboard: 0 });
    expect(b.rng).toBe(123);
  });

  it('excludes bow and stern targets and rotates the two side arcs with heading', () => {
    const s = { x: 0, y: 0, heading: 0 };
    expect(broadsideBattery(s, { x: 100, y: 0 })).toBeNull();
    expect(broadsideBattery(s, { x: -100, y: 0 })).toBeNull();
    expect(broadsideBattery(s, { x: 0, y: -100 })).toBe('port');
    expect(broadsideBattery(s, { x: 0, y: 100 })).toBe('starboard');
    expect(broadsideBattery({ ...s, heading: 90 }, { x: 100, y: 0 })).toBe('port');
    expect(broadsideBattery({ ...s, heading: 90 }, { x: -100, y: 0 })).toBe('starboard');
  });

  it('replays simultaneous batteries deterministically through JSON state and log round trips', () => {
    const initial: BattleSetup = { seed: 123, attackers: [ship(1)], defenders: [ship(2), ship(3)] };
    for (const s of [...initial.attackers, ...initial.defenders]) { s.firepower = 1; s.durability = s.maxDurability = 1000; }
    const log: BattleLog = [
      { tick: 0, side: 'attacker', cmd: { type: 'move', shipIds: [1], x: 1200, y: 675 } },
      { tick: 0, side: 'defender', cmd: { type: 'move', shipIds: [2], x: 1200, y: 375 } },
      { tick: 0, side: 'defender', cmd: { type: 'move', shipIds: [3], x: 1200, y: 975 } },
    ];
    let live = createBattle(initial), simultaneous = false;
    while (!live.outcome) {
      for (const entry of log.filter(e => e.tick === live.tick)) issueCommand(live, entry.side, entry.cmd);
      stepBattle(live);
      const reload = live.ships[0].reload;
      simultaneous ||= reload.port === BATTLE_STATS.warship.reload && reload.starboard === BATTLE_STATS.warship.reload;
      if (live.tick === 500) live = JSON.parse(JSON.stringify(live));
    }
    expect(simultaneous).toBe(true);
    expect(replayBattle(initial, log)).toEqual(battleResult(live));
    expect(replayBattle(JSON.parse(JSON.stringify(initial)), JSON.parse(JSON.stringify(log)))).toEqual(battleResult(live));
  });
});
