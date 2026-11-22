import { describe, expect, it } from 'vitest';
import { aiShouldClaim, aiTravelTarget } from './ai';
import { GameEngine } from './engine';
import { forecastMap } from './testMap';
import { createNationRoster } from './nations';
import { SEA_RULES } from './seaRules';

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
    player.fleet = player.fleet.slice(0, 3);
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

  it.each(['port', 'pirates', 'largeMonster', 'whirlpool', 'skeleton', 'dragonSnake'] as const)('forecasts reachable %s costs before a subsequent toll, excluding optional recruiting', (stop) => {
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
      else if (stop === 'pirates' || stop === 'largeMonster' || stop === 'whirlpool') {
        hazard.kind = 'event'; hazard.event = stop;
      } else {
        hazard.kind = 'special'; hazard.special = stop;
      }
    }
    expect(aiShouldClaim(state, player, node.id)).toBe(stop === 'dragonSnake');
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

describe('AI rival difficulty', () => {
  const at = (place: string, rival = false) => {
    const roster = createNationRoster([{ name: 'Captain', nation: 'Spain' }], 'hard').slice(0, 2).reverse();
    const engine = new GameEngine({ players: roster, rng: () => 0.5 });
    const { state, currentPlayer: player } = engine;
    const node = state.map.find((n) => n.special === place || n.kind === place)!;
    player.position = node.id;
    if (node.kind === 'island') state.owners[node.id] = rival ? 1 : 0;
    state.phase = 'moving';
    engine.resolveLanding();
    return { engine, state, player, node };
  };

  it('sets difficulty only on AI seats without changing starting resources', () => {
    const picks = [{ name: 'Captain', nation: 'Spain' as const }];
    const easy = new GameEngine({ players: createNationRoster(picks, 'easy'), rng: () => 0.5 });
    const hard = new GameEngine({ players: createNationRoster(picks, 'hard'), rng: () => 0.5 });
    expect(hard.currentPlayer.aiDifficulty).toBeUndefined();
    expect(hard.state.players.slice(1).every((p) => p.aiDifficulty === 'hard')).toBe(true);
    expect(hard.state.players.map(({ aiDifficulty, ...player }) => player))
      .toEqual(easy.state.players.map(({ aiDifficulty, ...player }) => player));
  });

  it('develops a supply chain, launches a legal ship and loads its local specialty', () => {
    const { engine, state, player, node } = at('island');
    player.fleet = player.fleet.slice(0, 3);
    engine.decideForAI();
    expect(state.buildings[node.id]).toMatchObject({ lumberMill: 1, ironMine: 1, shipyard: 1 });
    expect(state.buildings[node.id].collectionField).toBeGreaterThanOrEqual(1);
    expect(player.fleet).toHaveLength(3);
    state.currentPlayer = player.id;
    state.phase = 'awaitingBuild';
    Object.assign(state.stockpiles[node.id], { lumber: 2, iron: 1, specialties: { [node.specialty!]: 7 } });
    engine.decideForAI();
    expect(player.fleet).toHaveLength(4);
    expect(state.stockpiles[node.id]).toEqual({ lumber: 0, iron: 0, specialties: { [node.specialty!]: 0 } });
    expect(player.fleet[0].cargo[node.specialty!]).toBe(7);
  });

  it.each(['easy', 'normal', 'hard'] as const)('%s replaces a lost ship with an affordable fallback', (difficulty) => {
    const { engine, player } = at('skeleton');
    player.aiDifficulty = difficulty;
    player.fleet = player.fleet.slice(0, 3);
    player.fleet.shift();
    player.gold = 800;
    engine.decideForAI();
    expect(player.gold).toBeGreaterThanOrEqual(400);
    expect(player.fleet).toHaveLength(3);
    expect(player.fleet.at(-1)?.type).toBe('explorer');
  });

  it('Hard sells cargo and buys only a discounted specialty while Normal just sells', () => {
    for (const difficulty of ['hard', 'normal'] as const) {
      const { engine, state, player } = at('nightless');
      player.aiDifficulty = difficulty;
      state.market.stock.Silver = 40;
      player.fleet[0].cargo.Wine = 3;
      engine.decideForAI();
      expect(player.fleet[0].cargo.Wine).toBeUndefined();
      expect(player.fleet.some((ship) => (ship.cargo.Silver ?? 0) > 0)).toBe(difficulty === 'hard');
      expect(player.gold).toBeGreaterThan(400);
    }
  });

  it('Hard takes an immediate win over the known hoard and ignores hidden treasure information', () => {
    const { state, player } = at('island');
    const known = state.map.find((n) => n.id === state.hoardNode)!;
    player.knownHoard = known.id;
    state.config.islandsToWin = 2;
    const choice = aiTravelTarget(state, player)!;
    expect(state.map[choice].kind).toBe('island');
    expect(state.owners[choice]).toBeNull();
    player.knownHoard = null;
    state.hoardNode = null;
    expect(aiTravelTarget(state, player)).toBe(choice);
  });

  it('Hard navigates to buy a warship while keeping enough gold to settle more islands', () => {
    const { engine, state, player, node } = at('island');
    player.fleet.pop();
    const market = state.map.find((stop) => stop.special === 'skeleton')!;
    player.strategies = ['navigate'];
    player.gold = 800;
    expect(aiTravelTarget(state, player)).not.toBe(market.id);

    player.gold = 1400;
    player.position = node.id;
    state.phase = 'awaitingSpin';
    engine.decideForAI();
    expect(state.phase).toBe('awaitingMarket');
    expect(player.position).toBe(market.id);
    engine.decideForAI();
    expect(player.fleet.at(-1)?.type).toBe('warship');
    expect(player.gold).toBeGreaterThanOrEqual(400);
  });

  it('Hard keeps Navigate when a normal spin already guarantees a home salary', () => {
    const map = Array.from({ length: 20 }, (_, id) => ({ id, name: `Port ${id}`, kind: 'port' as const, x: id, y: 0 }));
    const game = new GameEngine({ map, players: [{ name: 'Rival', color: 0, isAI: true, aiDifficulty: 'hard' }] });
    const player = game.currentPlayer;
    player.position = (player.homePort + map.length - 2) % map.length;
    expect(aiTravelTarget(game.state, player)).toBeUndefined();
  });

  it('Hard wins the Mist duel and earns Navigate with no random choices', () => {
    const { engine, state, player } = at('mist');
    player.strategies = [];
    const gold = player.gold;
    engine.decideForAI();
    expect(state.mistResults).toMatchObject([{ hermitId: 'brook', outcome: 'win', strategy: 'navigate' }]);
    expect(player.gold).toBe(gold + SEA_RULES.nimPrize);
    expect(player.strategies).toEqual(['navigate']);
    expect(state.phase).toBe('awaitingSpin');
  });

  it('does not burn a battle card when the fleet can win without it', () => {
    const { engine, state, player } = at('island', true);
    const rival = state.players[1];
    rival.fleet = rival.fleet.slice(0, 1);
    rival.fleet[0].durability = 5;
    player.strategies = ['inspire'];
    engine.decideForAI();
    expect(player.strategies).toEqual(['inspire']);
    expect(state.battles[0].outcome).toBe('victory');
  });

  it('Hard recruits a healthy defector in a favorable battle while Normal saves the card', () => {
    for (const difficulty of ['hard', 'normal'] as const) {
      const { engine, state, player } = at('island', true);
      const defector = state.players[1].fleet[0];
      player.aiDifficulty = difficulty;
      player.strategies = ['betray'];
      for (const ship of player.fleet) ship.firepower = 120;
      engine.decideForAI();
      expect(state.battles[0].outcome).toBe('victory');
      expect(player.fleet.includes(defector)).toBe(difficulty === 'hard');
      expect(player.strategies).toEqual(difficulty === 'hard' ? [] : ['betray']);
    }
  });

  it('Hard can disarm a major rival and still pay the toll instead of risking the fleet', () => {
    const { engine, state, player } = at('island', true);
    const rival = state.players[1];
    const warship = rival.fleet[0];
    expect(warship.type).toBe('warship');
    const gold = player.gold;
    player.strategies = ['mislead'];
    for (const ship of player.fleet) ship.firepower = 1;
    engine.decideForAI();
    expect(rival.fleet).not.toContain(warship);
    expect(player.strategies).toEqual([]);
    expect(player.gold).toBeLessThan(gold);
    expect(state.battles).toHaveLength(0);
  });
});
