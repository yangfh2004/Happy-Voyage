import { describe, expect, it } from 'vitest';
import { GameEngine } from '@happy-voyage/shared';
import { TurnFeedback } from './TurnFeedback';

function fixture() {
  const engine = new GameEngine({ players: [
    { name: 'Captain', color: 0, isAI: false },
    { name: 'England', color: 1, isAI: true },
  ] });
  const feedback = new TurnFeedback();
  const state = engine.state;
  feedback.observe({ type: 'turnStarted', playerId: 0 }, state);
  return { feedback, state };
}

describe('turn feedback', () => {
  it('hides first and empty summaries, including rival-to-rival tolls', () => {
    const { feedback, state } = fixture();
    expect(feedback.summary).toBeNull();
    feedback.observe({ type: 'turnStarted', playerId: 1 }, state);
    feedback.observe({ type: 'tollPaid', from: 1, to: 1, amount: 40 }, state);
    feedback.observe({ type: 'turnStarted', playerId: 0 }, state);
    expect(feedback.summary).toBeNull();
    expect(feedback.logTones.size).toBe(0);
  });

  it('excludes the previous human turn and measures gold only while waiting', () => {
    const { feedback, state } = fixture();
    state.log.push('Captain pays toll');
    feedback.observe({ type: 'tollPaid', from: 0, to: 1, amount: 50 }, state);
    state.players[0].gold -= 50;
    state.players[0].gold -= 260;
    feedback.observe({ type: 'claimed', playerId: 0, nodeId: 2 }, state);
    feedback.observe({ type: 'turnStarted', playerId: 1 }, state);
    state.log.push('England pays toll');
    feedback.observe({ type: 'tollPaid', from: 1, to: 0, amount: 80 }, state);
    feedback.observe({ type: 'claimed', playerId: 1, nodeId: 1 }, state);
    state.players[0].gold += 80;
    feedback.observe({ type: 'turnStarted', playerId: 1 }, state);
    feedback.observe({ type: 'turnStarted', playerId: 0 }, state);
    expect(feedback.summary).toEqual({
      tolls: [
        { direction: 'received', name: 'England', amount: 80 },
      ],
      claims: [{ name: 'England', island: state.map[1].name }],
      netGold: 80,
    });
    expect([...feedback.logTones]).toEqual([[0, 'expense'], [1, 'income']]);
    feedback.observe({ type: 'turnStarted', playerId: 0 }, state);
    expect(feedback.summary).toBeNull();
  });

  it('summarizes net changes without tolls or claims', () => {
    const { feedback, state } = fixture();
    feedback.observe({ type: 'turnStarted', playerId: 1 }, state);
    state.players[0].gold -= 75;
    feedback.observe({ type: 'turnStarted', playerId: 0 }, state);
    expect(feedback.summary).toEqual({ tolls: [], claims: [], netGold: -75 });
  });

  it('hides a quiet wait even after a human purchase or decline', () => {
    const { feedback, state } = fixture();
    for (const cost of [200, 0]) {
      state.players[0].gold -= cost;
      feedback.observe({ type: 'turnStarted', playerId: 1 }, state);
      feedback.observe({ type: 'turnStarted', playerId: 0 }, state);
      expect(feedback.summary).toBeNull();
    }
  });

  it('handles an AI-only state without a summary', () => {
    const { feedback, state } = fixture();
    state.players[0].isAI = true;
    expect(() => feedback.observe({ type: 'turnStarted', playerId: 1 }, state)).not.toThrow();
    expect(feedback.summary).toBeNull();
  });
});
