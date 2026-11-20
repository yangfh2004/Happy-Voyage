import { describe, expect, it } from 'vitest';
import { aiShouldClaim } from './ai';
import { GameEngine } from './engine';

function claimOffer(maxRounds = 30, islandsToWin = 8) {
  const engine = new GameEngine({
    players: [
      { name: 'Rival', color: 0, isAI: true },
      { name: 'Captain', color: 1, isAI: false },
    ],
    config: { maxRounds, islandsToWin },
  });
  const { state, currentPlayer: player } = engine;
  const node = state.map[17];
  player.position = node.id;
  player.gold = node.price! + 20;
  state.pendingClaim = node.id;
  state.phase = 'awaitingClaim';
  return { engine, state, player, node };
}

describe('AI colony decisions', () => {
  it('saves cash for a likely toll rather than using a flat reserve', () => {
    const { engine, state, node } = claimOffer();
    state.owners[23] = 1; // A roll of six lands before salary and costs 124g.
    engine.decideForAI();
    expect(state.owners[node.id]).toBeNull();
  });

  it('uses the same cash to buy if nearby tolls are covered by salary', () => {
    const { engine, state, node } = claimOffer();
    state.owners[1] = 1; // A roll of eight lands after salary.
    engine.decideForAI();
    expect(state.owners[node.id]).toBe(0);
  });

  it('takes an affordable winning colony despite the risk', () => {
    const { engine, state, player, node } = claimOffer(30, 1);
    state.owners[23] = 1;
    player.gold = node.price!;
    expect(aiShouldClaim(state, player, node.id)).toBe(true);
    player.gold--;
    expect(aiShouldClaim(state, player, node.id)).toBe(false);
    player.gold++;
    engine.decideForAI();
    expect(state.winner).toBe(0);
  });

  it('keeps cash when a late colony cannot earn its score cost', () => {
    const { engine, state, node } = claimOffer(1);
    state.players[1].position = 10; // Even a likely roll of seven is not enough expected toll.
    engine.decideForAI();
    expect(state.owners[node.id]).toBeNull();
  });
});
