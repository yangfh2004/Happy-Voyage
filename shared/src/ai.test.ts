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
  function portRoute(maxRounds: number) {
    const map = Array.from({ length: 40 }, (_, id) => ({
      id, name: `Stop ${id}`, x: id, y: 0,
      kind: id === 1 || id === 35 ? 'island' as const : 'port' as const,
      price: 100,
    }));
    const engine = new GameEngine({
      players: [{ name: 'Rival', color: 0, isAI: true }],
      map, config: { maxRounds, islandsToWin: 2, homeSalary: 0 },
    });
    engine.currentPlayer.position = 1;
    return engine;
  }

  it('uses rank-discounted tax before forecasting loss of the last ship', () => {
    const { state, currentPlayer: player } = portRoute(2);
    player.gold = 120;
    player.fleet = [player.fleet[0]];
    expect(aiShouldClaim(state, player, 1)).toBe(false);
    player.rank = 5;
    expect(aiShouldClaim(state, player, 1)).toBe(true);
  });

  it('tracks seized ships across both forecast moves without mutating the fleet', () => {
    const { state, currentPlayer: player } = portRoute(3);
    player.gold = 100;
    expect(aiShouldClaim(state, player, 1)).toBe(true);
    expect(player.fleet).toHaveLength(3);
    player.fleet.pop();
    expect(aiShouldClaim(state, player, 1)).toBe(false);
    expect(player.fleet).toHaveLength(2);
  });

  it('includes rank salary bonuses when forecasting a home pass before tolls', () => {
    const map = forecastMap().slice(0, 4);
    map[1] = { ...map[1], price: 0 };
    map[2] = { ...map[2], kind: 'island', toll: 60 };
    map[3] = { ...map[3], kind: 'island', toll: 60 };
    const engine = new GameEngine({
      players: [{ name: 'Rival', color: 0, isAI: true }, { name: 'Host', color: 1, isAI: false }],
      map, config: { homeSalary: 0, maxRounds: 2, islandsToWin: 3 },
    });
    const { state, currentPlayer: player } = engine;
    player.position = 1;
    player.gold = map[1].price! + 20;
    state.owners[2] = 1;
    state.owners[3] = 1;
    expect(aiShouldClaim(state, player, 1)).toBe(false);
    player.rank = 1;
    expect(aiShouldClaim(state, player, 1)).toBe(true);
  });

  it.each(['port', 'pirates', 'seaMonster', 'whirlpool', 'skeleton', 'dragonSnake'] as const)('reserves cash for reachable %s costs before a subsequent toll', (stop) => {
    const { state, player, node } = claimOffer(30, 8, 1);
    state.config.homeSalary = 0;
    player.gold = node.price! + 50;
    for (const target of state.map) {
      if (target.id === 1) continue;
      target.kind = 'island';
      delete target.event;
      target.toll = 20;
      state.owners[target.id] = 1;
    }
    expect(aiShouldClaim(state, player, node.id)).toBe(true);
    for (const id of [7, 8, 9]) {
      const hazard = state.map[id];
      state.owners[id] = null;
      if (stop === 'port') hazard.kind = 'port';
      else if (stop === 'pirates' || stop === 'seaMonster' || stop === 'whirlpool') {
        hazard.kind = 'event'; hazard.event = stop;
      } else {
        hazard.kind = 'special'; hazard.special = stop;
      }
    }
    expect(aiShouldClaim(state, player, node.id)).toBe(false);
    player.gold += 500;
    expect(aiShouldClaim(state, player, node.id)).toBe(true);
  });
  it('saves cash for a likely toll rather than using a flat reserve', () => {
    const { engine, state, node } = claimOffer();
    state.owners[23] = 1; // Six steps land before salary and cost 124g.
    engine.decideForAI();
    expect(state.owners[node.id]).toBeNull();
  });

  it('uses the same cash to buy if nearby tolls are covered by salary', () => {
    const { engine, state, node } = claimOffer();
    state.owners[1] = 1; // Eight steps land after salary.
    engine.decideForAI();
    expect(state.owners[node.id]).toBe(0);
  });

  it.each([
    { event: 'treasure', colony: 6, toll: 22 },
    { event: 'trade wind', colony: 1, toll: 20 },
  ])('accounts for $event income before a second-move toll', ({ colony, toll }) => {
    const { engine, state, player, node } = claimOffer(30, 8, colony);
    player.gold = node.price! + 75;
    state.owners[toll] = 1;

    engine.decideForAI();
    expect(state.owners[colony]).toBe(0);
  });

  it('counts multiple salaries in one move when forecasting toll risk on a short route', () => {
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
    state.players[1].position = 10; // Even a likely spin of seven is not enough expected toll.
    engine.decideForAI();
    expect(state.owners[node.id]).toBeNull();
  });
});
