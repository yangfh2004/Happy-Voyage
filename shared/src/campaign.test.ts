import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { quoteMarketTrade } from './market';
import { NO_ROUND_LIMIT } from './modes';
import type { CampaignStageId } from './campaign';
import type { GameEvent, MarketOrder } from './types';

function voyage(stage: CampaignStageId) {
  const game = new GameEngine({ campaign: { stage, navigator: { name: 'Admiral', nation: 'Spain' } }, rng: () => 0 });
  const { state } = game;
  const missions: GameEvent[] = [];
  game.on((event) => { if (event.type === 'campaignMissionCompleted') missions.push(event); });
  game.start();
  return { game, state, captain: state.players[0], missions, islands: state.map.filter((node) => node.kind === 'island') };
}

function landAs(game: GameEngine, playerId: number, nodeId: number) {
  game.state.currentPlayer = playerId;
  game.currentPlayer.position = nodeId;
  game.state.phase = 'moving';
  game.resolveLanding();
}

describe('royal campaign', () => {
  it.each([
    ['first-voyage', 1, 'easy', NO_ROUND_LIMIT, 1400],
    ['merchant-charter', 2, 'normal', 28, 1600],
    ['crown-of-the-seas', 3, 'hard', 20, 1200],
  ] as const)('starts %s with its own roster, rules, and fresh mission progress', (stage, rivals, difficulty, maxRounds, startingGold) => {
    const { state, captain } = voyage(stage);
    expect(state.campaign).toEqual({ stage, playerId: 0, progress: {}, status: 'active' });
    expect(state.players).toHaveLength(rivals + 1);
    expect(state.players.slice(1)).toEqual(Array(rivals).fill(expect.objectContaining({ isAI: true, aiDifficulty: difficulty })));
    expect(captain).toMatchObject({ name: 'Admiral', nation: 'Spain', gold: startingGold, isAI: false });
    expect(captain.strategies.filter((card) => card === 'navigate')).toHaveLength(1);
    expect(state.config.maxRounds).toBe(maxRounds);
    expect(JSON.parse(JSON.stringify(state)).campaign).toEqual(state.campaign);
  });

  it('awards First Voyage missions only for your own founding and subsequent audience', () => {
    const { game, state, captain, missions, islands } = voyage('first-voyage');
    const [first, second, third] = islands;
    landAs(game, 0, captain.homePort);
    landAs(game, 1, third.id);
    expect(state.campaign!.progress).toEqual({});

    state.currentPlayer = captain.id;
    const before = captain.gold;
    game.useStrategy('navigate', first.id);
    expect(captain.gold).toBe(before + 150);
    expect(state.campaign).toMatchObject({ status: 'active', progress: { foundColony: 1 } });

    landAs(game, 0, second.id);
    expect(missions).toHaveLength(1);
    landAs(game, 0, captain.homePort);
    expect(missions).toHaveLength(2);
    expect(state.campaign).toMatchObject({ status: 'completed', progress: { foundColony: 1, reportHome: 1 } });
    expect(state).toMatchObject({ phase: 'gameOver', winner: captain.id, victory: 'campaign' });
  });

  it('counts only Nightless specialty sales and pays the charter reward once', () => {
    const { game, state, captain, missions, islands } = voyage('merchant-charter');
    const market = state.map.find((node) => node.special === 'nightless')!;
    game.useStrategy('navigate', market.id);
    const shipId = captain.fleet.find((ship) => ship.type === 'cargo')!.id;
    const trade = (side: MarketOrder['side'], good: MarketOrder['good'], quantity: number) =>
      game.tradeAtMarket({ side, good, quantity, shipId });
    trade('buy', 'iron', 1);
    trade('sell', 'iron', 1);
    trade('buy', 'Wine', 4);
    expect(state.campaign!.progress).toEqual({});
    trade('sell', 'Wine', 1);
    expect(state.campaign!.progress).toEqual({ sellSpecialties: 1 });
    const sales: MarketOrder = { side: 'sell', good: 'Wine', quantity: 2, shipId };
    const proceeds = quoteMarketTrade(state, sales)!;
    const before = captain.gold;
    game.tradeAtMarket(sales);
    expect(captain.gold).toBe(before + proceeds + 200);
    trade('sell', 'Wine', 1);
    expect(state.campaign!.progress).toEqual({ sellSpecialties: 3 });
    expect(missions).toHaveLength(1);
    game.finishTrading();

    landAs(game, 0, islands[0].id);
    landAs(game, 0, islands[0].id);
    game.build('lumberMill');
    expect(missions).toHaveLength(1);
    game.build('collectionField');
    expect(missions).toHaveLength(2);
    expect(state.phase).toBe('awaitingBuild');
    game.finishBuilding();
    expect(state.campaign!.status).toBe('completed');
  });

  it('requires simultaneous holdings and a successful capture to complete Crown of the Seas', () => {
    const { game, state, captain, missions, islands } = voyage('crown-of-the-seas');
    const [first, second, rivalColony] = islands;
    game.useStrategy('navigate', first.id);
    expect(state.campaign!.progress).toEqual({ holdColonies: 1 });
    state.owners[first.id] = 1; // The rival took our original colony.
    landAs(game, 0, second.id);
    expect(state.campaign!.progress).toEqual({ holdColonies: 1 });
    expect(missions).toHaveLength(0);
    state.owners[rivalColony.id] = 1;
    for (const ship of state.players[1].fleet) ship.durability = 1;
    landAs(game, 0, rivalColony.id);
    game.payToll();
    expect(state.campaign!.progress).toEqual({ holdColonies: 1 });

    landAs(game, 0, rivalColony.id);
    expect(game.fight().outcome).toBe('victory');
    expect(state.owners[rivalColony.id]).toBe(captain.id);
    expect(missions).toHaveLength(2);
    expect(state.campaign).toMatchObject({ status: 'completed', progress: { holdColonies: 2, captureColony: 1 } });
  });

  it('ends an unfinished timed stage after its final round, not by richest or last afloat', () => {
    const { game, state } = voyage('merchant-charter');
    const winds = state.map.find((node) => node.event === 'tradeWind')!;
    state.round = state.config.maxRounds - 1;
    for (const rival of state.players.slice(1)) rival.bankrupt = true;
    landAs(game, 0, winds.id);
    expect(state.campaign!.status).toBe('active');
    expect(state.round).toBe(state.config.maxRounds);
    landAs(game, 0, winds.id);
    expect(state).toMatchObject({ phase: 'gameOver', winner: null, victory: null, campaign: { status: 'failed' } });
    expect(state.log.at(-1)).toBe('The 28-round deadline passed.');
  });

  it('can finish all missions on the final allowed round', () => {
    const { game, state, islands } = voyage('crown-of-the-seas');
    state.round = state.config.maxRounds;
    state.owners[islands[0].id] = 0;
    state.owners[islands[1].id] = 1;
    for (const ship of state.players[1].fleet) ship.durability = 1;
    landAs(game, 0, islands[1].id);
    game.fight();
    expect(state.campaign!.status).toBe('completed');
  });

  it('fails the tutorial on bankruptcy rather than declaring a rival the winner', () => {
    const { game, state, captain } = voyage('first-voyage');
    const storm = state.map.find((node) => node.event === 'storm')!;
    captain.gold = 0;
    landAs(game, 0, storm.id);
    expect(captain.bankrupt).toBe(true);
    expect(state).toMatchObject({ phase: 'gameOver', winner: null, campaign: { status: 'failed' } });
  });
});
