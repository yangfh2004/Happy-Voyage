import { describe, expect, it } from 'vitest';
import { GameEngine, replayBattle, battleResult } from '@happy-voyage/shared';
import { BattleSession } from './BattleSession';

describe('live battle commands', () => {
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
