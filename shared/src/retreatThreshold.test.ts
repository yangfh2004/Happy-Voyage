import { describe, expect, it } from 'vitest';
import { battleResult, createBattle, issueCommand, replayBattle, stepBattle, TICK, type BattleLog } from './battle';
import { fightNavalBattle, forecastColonyBattle, forecastNavalBattle } from './combat';
import { GameEngine } from './engine';
import { SHIP_TYPES } from './ships';
import type { Ship } from './types';
import { isRetreatThreshold, playerRetreatThreshold, RETREAT_THRESHOLDS, sinkingCap, withdrawalReason } from './withdrawal';

const fleet = (n: number): Ship[] => Array.from({ length: n }, (_, i) => ({ ...SHIP_TYPES.warship, id: i + 1, name: `Ship ${i + 1}`, type: 'warship', durability: 100, maxDurability: 100, firepower: 0, cargo: {} }));
function siege(attackerAI = false, defenderAI = false) {
  const engine = new GameEngine({ players: [{ name: 'Attacker', color: 0, isAI: attackerAI }, { name: 'Defender', color: 1, isAI: defenderAI }], rng: () => .5, config: { battleMode: 'realtime', startingStrategies: 0 } });
  const island = engine.state.map.find(n => n.kind === 'island')!;
  engine.currentPlayer.position = island.id; engine.state.owners[island.id] = 1; engine.state.phase = 'awaitingToll';
  return engine;
}

describe('configurable retreat thresholds', () => {
  it.each(['auto', 'realtime'] as const)('pirates spare the actual last-sunk ship and its cargo in %s mode', mode => {
    const engine = siege();
    engine.state.config.battleMode = mode;
    const player = engine.currentPlayer;
    player.retreatThreshold = 'last';
    player.fleet = fleet(3);
    player.fleet.forEach((s, i) => { s.durability = i === 0 ? 10 : 1; s.cargo = { wood: i + 1 }; });
    const node = engine.state.map.find(n => n.event === 'openSea')!;
    node.event = 'pirates'; player.position = node.id;
    const ships = [...player.fleet];
    let lastSunk = ships[0].id;
    engine.state.phase = 'moving'; engine.resolveLanding();
    if (mode === 'realtime') {
      const setup = engine.state.pendingBattle!.setup;
      const log: BattleLog = [{ tick: 0, side: 'attacker', cmd: { type: 'move', shipIds: [ships[2].id], x: 2000, y: 675 } }];
      const battle = createBattle(setup);
      const sinkingOrder: number[] = [];
      issueCommand(battle, 'attacker', log[0].cmd);
      while (!battle.outcome) {
        const afloat = battle.ships.filter(s => s.side === 'attacker' && !s.sunk);
        stepBattle(battle, { defender: 'normal' });
        sinkingOrder.push(...afloat.filter(s => s.sunk).map(s => s.id));
      }
      expect(sinkingOrder).toHaveLength(3);
      lastSunk = sinkingOrder[2];
      expect(lastSunk).not.toBe(ships[2].id);
      expect(battleResult(battle).attackerSunk).toEqual(sinkingOrder);
      engine.finishBattle(JSON.parse(JSON.stringify(log)));
    }
    expect(player.fleet.map(s => s.id)).toEqual([lastSunk]);
    expect(player.fleet[0]).toMatchObject({ durability: 1, cargo: ships.find(s => s.id === lastSunk)!.cargo });
  });

  it.each(RETREAT_THRESHOLDS)('calculates %s losses for fleet sizes 1–26', threshold => {
    for (let n = 1; n <= 26; n++) {
      expect(sinkingCap(fleet(n), threshold)).toBe(threshold === 'last' ? n : Math.max(1, Math.ceil(n * { quarter: .25, half: .5, threeQuarters: .75 }[threshold])));
    }
    expect(withdrawalReason([], threshold)).toBeNull();
    expect(withdrawalReason([{ ...fleet(1)[0], durability: 0, signature: true }], threshold)).toBeNull();
  });

  it.each(RETREAT_THRESHOLDS)('honors %s losses and flagship rules', threshold => {
    const ships = fleet(8);
    const k = sinkingCap(ships, threshold);
    ships.slice(1, k).forEach(s => { s.durability = 0; });
    expect(withdrawalReason(ships, threshold)).toBeNull();
    if (threshold !== 'last') {
      ships[k].durability = 0;
      expect(withdrawalReason(ships, threshold)).toBe('losses');
    }
    const flagshipFleet = fleet(5);
    flagshipFleet[0].signature = true; flagshipFleet[0].durability = 25;
    expect(withdrawalReason(flagshipFleet, threshold)).toBe(threshold === 'last' ? null : 'flagship');
  });

  it.each(RETREAT_THRESHOLDS)('enforces the same %s cap and outcome in auto-resolve, forecast and realtime', threshold => {
    const attackers = [{ ...fleet(1)[0], id: 100, firepower: 100000 }], defenders = fleet(5);
    const forecast = forecastNavalBattle(attackers, defenders, { defenderThreshold: threshold });
    const auto = fightNavalBattle(attackers, defenders, () => .5, { defenderThreshold: threshold });
    const battle = createBattle({ seed: 42, attackers, defenders: fleet(5), retreatThresholds: { defender: threshold } });
    battle.ships.forEach(s => { s.order = { type: 'move', x: s.x, y: s.y }; });
    battle.cannonballs = battle.ships.filter(s => s.side === 'defender').map(s => ({ side: 'attacker', shipId: 100, battery: 'port', x: s.x, y: s.y, landingX: s.x, landingY: s.y, remaining: TICK, damage: 100000 }));
    stepBattle(battle);
    const live = battleResult(battle);
    expect(live.outcome).toBe(auto.outcome); expect(forecast).toBe(auto.outcome);
    expect(live.defenderSunk).toEqual(auto.defenderSunk.map(s => s.id));
    expect(live.defenderSunk).toHaveLength(sinkingCap(fleet(5), threshold));
    expect(live.withdrawal).toEqual(auto.withdrawal);
    if (threshold === 'last') {
      expect(live.defenderSunk).toHaveLength(5);
      expect(live.withdrawal).toBeUndefined();
    }
  });

  it('applies a lowered threshold on the next step without altering the initial setup, and replays JSON changes exactly', () => {
    const setup = { seed: 42, attackers: fleet(5), defenders: [{ ...fleet(1)[0], id: 100 }], retreatThresholds: { attacker: 'last' as const } };
    const log: BattleLog = [{ tick: 5, side: 'attacker', cmd: { type: 'retreatThreshold', threshold: 'quarter' } }, { tick: 6, side: 'attacker', cmd: { type: 'retreatThreshold', threshold: 'threeQuarters' } }, { tick: 7, side: 'attacker', cmd: { type: 'retreat' } }];
    let live = createBattle(setup);
    while (!live.outcome) {
      for (const entry of log.filter(e => e.tick === live.tick)) issueCommand(live, entry.side, entry.cmd);
      stepBattle(live);
      if (live.tick === 3) live = JSON.parse(JSON.stringify(live));
    }
    expect(replayBattle(JSON.parse(JSON.stringify(setup)), JSON.parse(JSON.stringify(log)))).toEqual(battleResult(live));
    expect(live.retreatThresholds.attacker).toBe('threeQuarters');
    expect(setup.retreatThresholds.attacker).toBe('last');
    const wounded = createBattle({ ...setup, attackers: fleet(5).map((s, i) => ({ ...s, durability: i < 2 ? 1 : 100 })) });
    wounded.ships[1].durability = 0; wounded.ships[1].sunk = true;
    wounded.ships[2].durability = 0; wounded.ships[2].sunk = true;
    stepBattle(wounded); expect(wounded.outcome).toBeNull();
    issueCommand(wounded, 'attacker', { type: 'retreatThreshold', threshold: 'quarter' });
    stepBattle(wounded); expect(wounded.withdrawal).toEqual({ side: 'attacker', reason: 'losses' });
  });

  it('ignores invalid commands, including after a battle ends', () => {
    const battle = createBattle({ seed: 42, attackers: fleet(2), defenders: [{ ...fleet(1)[0], id: 100 }] });
    for (const threshold of [undefined, null, '', 'all', 4]) {
      expect(isRetreatThreshold(threshold)).toBe(false);
      issueCommand(battle, 'attacker', { type: 'retreatThreshold', threshold } as never);
      expect(battle.retreatThresholds.attacker).toBe('half');
    }
    issueCommand(battle, 'attacker', { type: 'retreat' });
    issueCommand(battle, 'attacker', { type: 'retreatThreshold', threshold: 'last' });
    expect(battle.retreatThresholds.attacker).toBe('half');
  });

  it('defaults new players and legacy states/setups to half and forces AI players to half', () => {
    const engine = siege();
    expect(engine.currentPlayer.retreatThreshold).toBe('half');
    const legacy = JSON.parse(JSON.stringify(engine.state));
    legacy.players.forEach((p: { retreatThreshold?: string }) => { delete p.retreatThreshold; });
    expect(playerRetreatThreshold(legacy.players[0])).toBe('half');
    expect(playerRetreatThreshold({ isAI: true, retreatThreshold: 'last' })).toBe('half');
    expect(createBattle({ seed: 1, attackers: [], defenders: [] }).retreatThresholds).toEqual({ attacker: 'half', defender: 'half' });
    delete engine.currentPlayer.retreatThreshold;
    engine.fight();
    expect(engine.state.pendingBattle!.setup.retreatThresholds?.attacker).toBe('half');
  });

  it('validates action phase, value and human ownership', () => {
    const engine = siege();
    engine.setRetreatThreshold('quarter'); expect(engine.currentPlayer.retreatThreshold).toBe('quarter');
    expect(() => engine.setRetreatThreshold('invalid' as never)).toThrow('Invalid retreat threshold');
    engine.state.phase = 'moving'; expect(() => engine.setRetreatThreshold('last')).toThrow('Cannot change');
    engine.state.phase = 'awaitingSpin'; engine.currentPlayer.isAI = true;
    expect(() => engine.setRetreatThreshold('last')).toThrow('Invalid retreat threshold');
  });

  it.each(['auto', 'realtime'] as const)('uses the player setting against half-threshold lone pirates in %s mode', mode => {
    const engine = siege();
    engine.state.config.battleMode = mode;
    engine.currentPlayer.retreatThreshold = 'last';
    const node = engine.state.map.find(n => n.event === 'openSea')!;
    node.event = 'pirates'; engine.currentPlayer.position = node.id;
    engine.currentPlayer.fleet.forEach(s => { s.firepower = 0; s.durability = s.id === 1 ? 1 : s.maxDurability; });
    const flagship = engine.currentPlayer.fleet[0];
    flagship.signature = true;
    engine.state.phase = 'moving'; engine.resolveLanding();
    if (mode === 'realtime') {
      expect(engine.state.pendingBattle!.setup.retreatThresholds).toEqual({ attacker: 'last', defender: 'half' });
      expect(engine.state.pendingBattle!.setup.defenders).toHaveLength(1);
      engine.finishBattle([{ tick: 0, side: 'attacker', cmd: { type: 'retreat' } }]);
    } else {
      expect(engine.currentPlayer.fleet.some(s => s.id === flagship.id)).toBe(false);
    }
  });

  it('snapshots each human owner, including docked defenders and computer-commanded human fleets, then persists authorized changes', () => {
    const engine = siege();
    engine.setRetreatThreshold('quarter');
    engine.state.players[1].retreatThreshold = 'last';
    engine.state.docks[engine.currentPlayer.position] = engine.state.players[1].fleet.splice(0, 2);
    engine.fight();
    expect(engine.state.pendingBattle!.setup.retreatThresholds).toEqual({ attacker: 'quarter', defender: 'last' });
    engine.finishBattle([{ tick: 0, side: 'attacker', cmd: { type: 'retreatThreshold', threshold: 'threeQuarters' } }, { tick: 0, side: 'defender', cmd: { type: 'retreatThreshold', threshold: 'quarter' } }, { tick: 1, side: 'attacker', cmd: { type: 'retreat' } }]);
    expect(engine.state.players[0].retreatThreshold).toBe('threeQuarters');
    expect(engine.state.players[1].retreatThreshold).toBe('last');
  });

  it('forecasts and auto-resolves using the colony owner threshold rather than the attacker setting', () => {
    const engine = siege();
    engine.state.config.battleMode = 'auto';
    engine.currentPlayer.fleet = [{ ...fleet(1)[0], firepower: 15 }];
    engine.state.players[1].fleet = fleet(2).map((s, i) => ({ ...s, id: i + 100, signature: i === 0, durability: i === 0 ? 25 : 100 }));
    engine.state.players[1].retreatThreshold = 'last';
    expect(forecastColonyBattle(engine.state, engine.currentPlayer)).toBe('draw');
    expect(engine.fight()!.outcome).toBe('draw');
    const ai = siege(true, true);
    ai.state.players.forEach(p => { p.retreatThreshold = 'last'; });
    ai.currentPlayer.fleet.forEach(s => { s.firepower = 100000; });
    const defenders = ai.state.players[1].fleet.length;
    expect(ai.fight()!.defenderSunk).toHaveLength(Math.ceil(defenders / 2));
  });
});
