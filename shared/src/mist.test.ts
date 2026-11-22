import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { hermitStoneTake, type HermitId } from './mist';
import { SEA_RULES } from './seaRules';
import { STRATEGY_RULES } from './strategies';

function arrive(isAI = false) {
  const g = new GameEngine({
    players: [{ name: 'Captain', color: 0, isAI }, { name: 'Rival', color: 1, isAI: true }],
    config: { startingStrategies: 0 },
    rng: () => 0,
  });
  g.currentPlayer.position = g.state.map.find((node) => node.special === 'mist')!.id;
  g.state.phase = 'moving';
  g.resolveLanding();
  return g;
}

describe('Mist Island hermit duel', () => {
  it('offers one challenge per landing and rejects invalid commands without changing the row', () => {
    const g = arrive();
    expect(g.state.phase).toBe('awaitingMistDuel');
    expect(g.state.mistDuel).toMatchObject({ hermitId: null, stonesLeft: SEA_RULES.nimStones, result: null });
    expect(() => g.takeMistStones(1)).toThrow('Cannot take');
    expect(() => g.challengeHermit('missing' as HermitId)).toThrow('Cannot challenge');
    g.challengeHermit('brook');
    expect(() => g.challengeHermit('summit')).toThrow('Cannot challenge');
    expect(() => g.leaveMistIsland()).toThrow('active');
    for (const count of [0, 4, 1.5, NaN]) expect(() => g.takeMistStones(count)).toThrow('Cannot take');
    expect(g.state.mistDuel?.stonesLeft).toBe(SEA_RULES.nimStones);
    g.takeMistStones(1);
    expect(g.state.mistDuel?.lastTurn).toEqual({ playerTake: 1, hermitTake: 1 });
    expect(g.state.mistDuel?.stonesLeft).toBe(SEA_RULES.nimStones - 2);
  });

  it.each([
    ['brook', [3, 3, 3], 'navigate'],
    ['pine', [3, 1, 1], 'locate'],
    ['summit', [3, 3, 3], 'inspire'],
  ] as const)('records a win against %s and teaches its strategy exactly once', (hermit, moves, strategy) => {
    const g = arrive();
    const player = g.currentPlayer;
    const gold = player.gold;
    const nodeId = player.position;
    g.challengeHermit(hermit);
    moves.forEach((count) => g.takeMistStones(count));
    expect(g.state.mistDuel).toMatchObject({ stonesLeft: 0, lastTurn: { hermitTake: 1 }, result: { outcome: 'win' } });
    expect(g.state.mistResults).toEqual([{ round: 1, playerId: player.id, nodeId, hermitId: hermit, outcome: 'win', strategy }]);
    expect(player.strategies).toEqual([strategy]);
    expect(player.gold).toBe(gold + SEA_RULES.nimPrize);
    expect(() => g.takeMistStones(1)).toThrow('Cannot take');
    g.leaveMistIsland();
    expect(g.state.mistDuel).toBeNull();
    expect(g.currentPlayer.id).toBe(1);
    expect(g.state.phase).toBe('awaitingSpin');
    expect(g.state.mistResults).toHaveLength(1);
  });

  it('records a loss without a reward when the player takes the last stone', () => {
    const g = arrive();
    const player = g.currentPlayer;
    const gold = player.gold;
    g.challengeHermit('brook');
    [1, 3, 3].forEach((count) => g.takeMistStones(count));
    expect(g.state.mistDuel?.stonesLeft).toBe(2);
    expect(() => g.takeMistStones(3)).toThrow('Cannot take');
    g.takeMistStones(2);
    expect(g.state.mistDuel?.lastTurn).toEqual({ playerTake: 2, hermitTake: null });
    g.leaveMistIsland();
    expect(g.state.mistResults).toMatchObject([{ outcome: 'loss', strategy: null }]);
    expect(player.strategies).toEqual([]);
    expect(player.gold).toBe(gold);
    expect(g.state.log.join(' ')).toContain('taking the last stone');
  });

  it('reports a win even when a full strategy hand cannot take the reward', () => {
    const g = arrive();
    const player = g.currentPlayer;
    for (let i = 0; i < STRATEGY_RULES.handCap; i++) g.gainStrategy(player.id, 'test', 'inspire');
    g.challengeHermit('brook');
    [3, 3, 3].forEach((count) => g.takeMistStones(count));
    expect(g.state.mistDuel?.result).toMatchObject({ outcome: 'win', strategy: null });
    expect(player.strategies).toHaveLength(STRATEGY_RULES.handCap);
  });

  it('can decline without a result and resolves AI turns without player input', () => {
    const g = arrive();
    g.leaveMistIsland();
    expect(g.currentPlayer.id).toBe(1);
    expect(g.state.mistResults).toEqual([]);
    const ai = arrive(true);
    ai.decideForAI();
    expect(ai.currentPlayer.id).toBe(1);
    expect(ai.state.mistDuel).toBeNull();
    expect(ai.state.mistResults).toMatchObject([{ outcome: 'win', playerId: 0, hermitId: 'brook' }]);
  });

  it('lets the expert take the move that leaves 1 mod 4 stones', () => {
    for (const stones of [2, 3, 4, 6, 7, 8, 10, 11, 12]) {
      expect((stones - hermitStoneTake('summit', stones)) % 4).toBe(1);
    }
  });

  it.each([1, 2, 3])('accepts a legal take of %i from the green row', (count) => {
    const g = arrive();
    g.challengeHermit('brook');
    g.takeMistStones(count);
    expect(g.state.mistDuel?.stonesLeft).toBe(SEA_RULES.nimStones - count - 1);
  });

  it.each(['easy', 'normal', 'hard'] as const)('resolves %s AI without a human window', (difficulty) => {
    const g = arrive(true);
    g.currentPlayer.aiDifficulty = difficulty;
    g.decideForAI();
    expect(g.state.mistDuel).toBeNull();
    expect(g.state.mistResults).toHaveLength(1);
    expect(g.state.mistResults[0].playerId).toBe(0);
    expect(g.currentPlayer.id).toBe(1);
  });
});
