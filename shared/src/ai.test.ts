import { describe, expect, it } from 'vitest';
import { aiTravelTarget } from './ai';
import { GameEngine } from './engine';
import { forecastMap } from './testMap';
import { createNationRoster } from './nations';
import { SEA_RULES } from './seaRules';
import { MAX_FLEET_SIZE } from './ships';

describe('AI colony decisions', () => {
  it.each(['easy', 'normal', 'hard'] as const)('chooses a free colony at low gold for %s Navigate and Wyvern travel', (difficulty) => {
    const map = Array.from({ length: 40 }, (_, id) => ({
      id, name: `Stop ${id}`, x: id, y: 0,
      kind: id === 0 ? 'port' as const : id <= 2 ? 'island' as const : 'event' as const,
      event: 'tradeWind' as const,
      price: 10_000,
    }));
    const engine = new GameEngine({
      players: [{ name: 'AI', color: 0, isAI: true, aiDifficulty: difficulty }, { name: 'Rival', color: 1, isAI: false }],
      map,
      config: { islandsToWin: 2, startingStrategies: 0, homeSalary: 0 },
    });
    const { state, currentPlayer: player } = engine;
    const islands = state.map.filter((node) => node.kind === 'island');
    for (const island of islands) state.owners[island.id] = 1;
    state.owners[islands[0].id] = 0;
    const target = islands[1];
    state.owners[target.id] = null;
    target.price = 10_000;
    player.gold = 0;
    for (const islandsToWin of [2, 3]) {
      state.config.islandsToWin = islandsToWin;
      for (const price of [10_000, 0, undefined]) {
        target.price = price;
        expect(aiTravelTarget(state, player)).toBe(target.id);
        expect(aiTravelTarget(state, player, true)).toBe(target.id);
      }
    }
  });

  it.each(['navigate', 'wyvern'] as const)('resolves a zero-gold winning colony through engine %s travel', (travel) => {
    const engine = new GameEngine({
      players: [{ name: 'AI', color: 0, isAI: true }, { name: 'Rival', color: 1, isAI: false }],
      map: forecastMap(),
      rng: () => 0.5,
      config: { islandsToWin: 1, startingStrategies: 0 },
    });
    const { state, currentPlayer: player } = engine;
    const target = state.map.find((node) => node.kind === 'island')!;
    for (const island of state.map.filter((node) => node.kind === 'island')) state.owners[island.id] = 1;
    state.owners[target.id] = null;
    player.gold = 0;
    if (travel === 'navigate') player.strategies = ['navigate'];
    else {
      state.phase = 'awaitingWyvern';
      state.pendingWyvern = true;
    }
    engine.decideForAI();
    if (travel === 'wyvern') engine.resolveLanding();
    expect(player.position).toBe(target.id);
    expect(state.owners[target.id]).toBe(player.id);
    expect(player.gold).toBe(0);
    expect(state.phase).toBe('awaitingBuild');
    engine.decideForAI();
    expect(state.winner).toBe(player.id);
  });

  it.each(['easy', 'normal'] as const)('has no colony target when none remain for %s', (difficulty) => {
    const engine = new GameEngine({ players: [{ name: 'AI', color: 0, isAI: true, aiDifficulty: difficulty }] });
    const { state, currentPlayer: player } = engine;
    for (const island of state.map.filter((node) => node.kind === 'island')) state.owners[island.id] = player.id;
    expect(aiTravelTarget(state, player)).toBeUndefined();
    expect(aiTravelTarget(state, player, true)).toBeDefined();
  });
});

describe('AI rival difficulty', () => {
  const at = (place: string, rival: boolean | null = false) => {
    const roster = createNationRoster([{ name: 'Captain', nation: 'Spain' }], 'hard').slice(0, 2).reverse();
    const engine = new GameEngine({ players: roster, rng: () => 0.5, config: { battleMode: 'auto' } });
    const { state, currentPlayer: player } = engine;
    const node = state.map.find((n) => n.special === place || n.kind === place)!;
    player.position = node.id;
    if (node.kind === 'island') state.owners[node.id] = rival === null ? null : rival ? 1 : 0;
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

  it('develops a newly claimed colony during the same turn', () => {
    const { engine, state, player, node } = at('island', null);
    expect(state.phase).toBe('awaitingBuild');
    expect(engine.currentPlayer.id).toBe(player.id);
    engine.decideForAI();
    expect(state.buildings[node.id].collectionField).toBeGreaterThan(0);
    expect(engine.currentPlayer.id).not.toBe(player.id);
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

  it.each([
    [0, 35, 'ambush'],
    [1, 35, 'ambush'],
    [0, 30, 'betray'],
    [1, 30, 'betray'],
  ] as const)('with %s fleet slots and defender firepower %s, chooses %s', (openSlots, defenderFirepower, card) => {
    const { engine, state, player, node } = at('island', true);
    player.aiDifficulty = 'normal';
    player.strategies = ['betray', 'ambush'];
    const colony = state.map.find((candidate) => candidate.kind === 'island' && candidate.id !== node.id)!;
    state.owners[colony.id] = player.id;
    while (player.fleet.length < MAX_FLEET_SIZE - openSlots) engine.addShipToFleet(player.id, 'cargo');
    for (const ship of player.fleet) { ship.firepower = 14; ship.durability = 50; }
    const flagship = player.fleet.find((ship) => ship.signature)!;
    flagship.durability = flagship.maxDurability;
    const warship = player.fleet.find((ship) => ship.type === 'warship')!;
    warship.durability = warship.maxDurability;
    const rival = state.players[1];
    const defectors = rival.fleet.slice(0, 2);
    rival.fleet.forEach((ship, i) => {
      ship.firepower = i < 2 ? 95 : defenderFirepower;
      ship.durability = i < 2 ? 80 : 25;
    });

    engine.decideForAI();

    expect(player.strategies).toEqual([card === 'ambush' ? 'betray' : 'ambush']);
    expect(state.battles[0]?.outcome).toBe('victory');
    expect(state.docks[colony.id]).toEqual(card === 'betray' ? defectors.slice(openSlots) : []);
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
