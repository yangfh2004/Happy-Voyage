import { describe, expect, it } from 'vitest';
import { GameEngine, replayBattle, battleResult } from '@happy-voyage/shared';
import { BattleSession } from './BattleSession';

describe('live battle commands', () => {
  it('logs immediate threshold changes and persists them through authoritative settlement', () => {
    const engine = new GameEngine({ players: [{ name: 'Human', color: 0, isAI: false }, { name: 'AI', color: 1, isAI: true }], rng: () => .5 });
    const node = engine.state.map.find(n => n.kind === 'island')!;
    engine.state.owners[node.id] = 1; engine.currentPlayer.position = node.id;
    engine.state.phase = 'awaitingToll'; engine.fight();
    const pending = engine.state.pendingBattle!;
    const session = new BattleSession(pending, engine.state.players);
    session.step();
    session.command({ type: 'retreatThreshold', threshold: 'last' });
    expect(session.battle.retreatThresholds.attacker).toBe('last');
    expect(session.log).toEqual([{ tick: 1, side: 'attacker', cmd: { type: 'retreatThreshold', threshold: 'last' } }]);
    expect(pending.setup.retreatThresholds?.attacker).toBe('half');
    session.command({ type: 'retreat' });
    expect(replayBattle(pending.setup, JSON.parse(JSON.stringify(session.log)), session.controllers)).toEqual(battleResult(session.battle));
    engine.finishBattle(session.log);
    expect(engine.state.players[pending.attacker].retreatThreshold).toBe('last');
    const count = session.log.length;
    session.command({ type: 'retreatThreshold', threshold: 'quarter' });
    expect(session.log).toHaveLength(count);
  });
  it.each(['move', 'attack', 'free'] as const)('reissues a selected group %s order when its formation changes', type => {
    const engine = new GameEngine({ players: [{ name: 'Human', color: 0, isAI: false }, { name: 'AI', color: 1, isAI: true }], rng: () => .5 });
    const node = engine.state.map.find(n => n.kind === 'island')!;
    engine.state.owners[node.id] = 1;
    engine.currentPlayer.position = node.id;
    engine.state.phase = 'awaitingToll'; engine.fight();
    const session = new BattleSession(engine.state.pendingBattle!, engine.state.players);
    const shipIds = session.battle.ships.filter(s => s.side === 'attacker').map(s => s.id);
    const order = type === 'move' ? { type, x: 1300, y: 675 } : type === 'attack' ? { type, targetId: engine.state.pendingBattle!.setup.defenders[0].id } : { type };
    session.command({ ...order, shipIds, formation: 'line' });
    session.changeFormation(shipIds, 'column');
    expect(session.battle.groups[0]).toMatchObject({ formation: 'column', order });
    expect(session.log.at(-1)!.cmd).toEqual({ ...order, shipIds, formation: 'column' });
    const count = session.log.length;
    session.changeFormation([], 'spread'); session.changeFormation([shipIds[0]], 'spread');
    expect(session.log).toHaveLength(count);
  });

  it('forms a holding group from an ungrouped selection', () => {
    const engine = new GameEngine({ players: [{ name: 'Human', color: 0, isAI: false }, { name: 'AI', color: 1, isAI: true }], rng: () => .5 });
    const node = engine.state.map.find(n => n.kind === 'island')!;
    engine.state.owners[node.id] = 1; engine.currentPlayer.position = node.id;
    engine.state.phase = 'awaitingToll'; engine.fight();
    const session = new BattleSession(engine.state.pendingBattle!, engine.state.players);
    const ids = session.battle.ships.filter(s => s.side === 'attacker').map(s => s.id);
    session.changeFormation(ids, 'spread');
    expect(session.battle.groups[0]).toMatchObject({ formation: 'spread', order: { type: 'free' } });
    const target = session.battle.ships.find(s => s.side === 'defender')!;
    session.command({ type: 'attack', shipIds: ids, targetId: target.id });
    target.sunk = true;
    session.changeFormation(ids, 'line');
    expect(session.log.at(-1)!.cmd).toMatchObject({ type: 'free', formation: 'line' });
  });

  it('records commands before their tick and matches replay exactly', () => {
    const engine = new GameEngine({ players: [{ name: 'Human', color: 0, isAI: false }, { name: 'AI', color: 1, isAI: true, aiDifficulty: 'hard' }] });
    const node = engine.state.map.find((n) => n.kind === 'island')!;
    engine.state.owners[node.id] = 1;
    engine.currentPlayer.position = node.id;
    engine.state.phase = 'awaitingToll';
    engine.fight();
    const pending = engine.state.pendingBattle!;
    const session = new BattleSession(pending, engine.state.players);
    expect(session.controllers).toEqual({ defender: 'hard' });
    const ids = session.battle.ships.filter((s) => s.side === 'attacker').map((s) => s.id);
    session.command({ type: 'move', shipIds: ids, x: 500, y: 300, formation: 'line' });
    ids.length = 0;
    expect(session.log[0]).toMatchObject({ tick: 0, side: 'attacker' });
    expect(session.log[0].cmd).toMatchObject({ shipIds: expect.arrayContaining([pending.setup.attackers[0].id]) });
    session.step();
    session.command({ type: 'retreat' });
    expect(session.log[1].tick).toBe(1);
    while (!session.battle.outcome) session.step();
    expect(battleResult(session.battle)).toEqual(replayBattle(pending.setup, session.log, session.controllers));
    const count = session.log.length;
    session.command({ type: 'free', shipIds: [] });
    expect(session.log).toHaveLength(count);
  });

  it('uses attacker difficulty when the human defends and normal pirate AI', () => {
    const engine = new GameEngine({ players: [{ name: 'AI', color: 0, isAI: true, aiDifficulty: 'easy' }, { name: 'Human', color: 1, isAI: false }] });
    const node = engine.state.map.find((n) => n.kind === 'island')!;
    engine.state.owners[node.id] = 1;
    engine.currentPlayer.position = node.id;
    engine.state.phase = 'awaitingToll';
    engine.fight();
    const pending = engine.state.pendingBattle!;
    expect(new BattleSession(pending, engine.state.players).controllers).toEqual({ attacker: 'easy' });
    expect(new BattleSession({ ...pending, defender: null, commanders: ['attacker'] }, engine.state.players).controllers).toEqual({ defender: 'normal' });
  });
});
