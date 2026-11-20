import { describe, expect, it } from 'vitest';
import { aiShouldClaim } from './ai';
import { GameEngine } from './engine';
import { forecastMap } from './testMap';

function claimOffer(maxRounds = 30, islandsToWin = 8, nodeId = 17) {
  const engine = new GameEngine({
    players: [
      { name: 'Rival', color: 0, isAI: true },
      { name: 'Captain', color: 1, isAI: false },
    ],
    config: { maxRounds, islandsToWin },
    map: forecastMap(),
  });
  const { state, currentPlayer: player } = engine;
  const node = state.map[nodeId];
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

  it.each([
    { event: 'treasure', colony: 6, toll: 22 },
    { event: 'trade wind', colony: 1, toll: 20 },
  ])('accounts for $event income before a second-roll toll', ({ colony, toll }) => {
    const { engine, state, player, node } = claimOffer(30, 8, colony);
    player.gold = node.price! + 75;
    state.owners[toll] = 1;

    engine.decideForAI();
    expect(state.owners[colony]).toBe(0);
  });

  it('counts multiple salaries on one roll when forecasting toll risk on a short route', () => {
    const route = forecastMap();
    const map = [route[0], route[1], { ...route[2], toll: 100 }, { ...route[4], id: 3 }];
    const game = new GameEngine({
      players: [
        { name: 'Rival', color: 0, isAI: true },
        { name: 'Captain', color: 1, isAI: false },
      ],
      map,
      config: { homeSalary: 50, maxRounds: 2, islandsToWin: 2 },
    });
    game.currentPlayer.position = 1;
    game.currentPlayer.gold = map[1].price!;
    game.state.owners[2] = 1;
    game.state.pendingClaim = 1;
    game.state.phase = 'awaitingClaim';

    // Only a five is risky: a nine also lands on stop 2, but earns two salaries.
    game.decideForAI();
    expect(game.state.owners[1]).toBe(0);
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
