import { describe, expect, it } from 'vitest';
import { aiShouldClaim } from './ai';
import { DEFAULT_CONFIG, GameEngine } from './engine';
import { DEFAULT_ISLAND_COUNT, GAME_MODES, gameMode, winConditionText } from './modes';
import type { GameConfig } from './types';

const players = [0, 1].map((i) => ({ name: `Captain ${i}`, color: i, isAI: false }));

function engineHolding(owned: number, config?: Partial<GameConfig>) {
  const g = new GameEngine({ players, config: { startingStrategies: 0, ...config } });
  const islands = g.state.map.filter((node) => node.kind === 'island');
  for (const island of islands.slice(0, owned)) g.state.owners[island.id] = 0;
  g.currentPlayer.gold = 10_000;
  return { g, last: islands[islands.length - 1] };
}

function claimAt(g: GameEngine, nodeId: number) {
  g.currentPlayer.position = nodeId;
  g.state.phase = 'moving';
  g.resolveLanding();
  g.claim();
}

describe('victory modes', () => {
  it('defaults to the original rule: every one of the 40 new continents, with no round limit', () => {
    expect(DEFAULT_ISLAND_COUNT).toBe(40);
    const { state } = new GameEngine({ players });
    expect(state.config.islandsToWin).toBe(40);
    expect(DEFAULT_CONFIG.maxRounds).toBe(gameMode('conquest').config.maxRounds);
  });

  it('wins with a victory screen state once one navigator holds every new continent', () => {
    const { g, last } = engineHolding(DEFAULT_ISLAND_COUNT - 1);
    const events: unknown[] = [];
    g.on((event) => { if (event.type === 'gameOver') events.push(event); });
    claimAt(g, last.id);
    expect(g.state.phase).toBe('gameOver');
    expect(g.state.winner).toBe(0);
    expect(g.state.victory).toBe('everyContinent');
    expect(events).toEqual([{ type: 'gameOver', winner: 0, victory: 'everyContinent', reason: 'holds all 40 new continents for the crown' }]);
  });

  it('keeps sailing in classic conquest with 39 of 40 continents, even past 50 rounds', () => {
    const { g } = engineHolding(DEFAULT_ISLAND_COUNT - 2);
    g.state.round = 60;
    claimAt(g, g.state.map.filter((node) => node.kind === 'island').at(-2)!.id);
    expect(g.islandsOwnedBy(0)).toBe(39);
    expect(g.state.phase).toBe('awaitingSpin');
    expect(g.state.victory).toBeNull();
    g.state.round = 5_000;
    g.spinCompass();
    g.sail();
    while (g.state.phase === 'moving') g.resolveLanding();
    if (g.state.phase === 'awaitingClaim') g.decline();
    expect(g.state.victory).toBeNull();
    const player = g.state.players[0];
    const neutral = g.state.map.find((node) => node.kind === 'island' && g.state.owners[node.id] === null)!;
    g.state.owners[g.state.map.findIndex((node, i) => node.kind === 'island' && i !== neutral.id)] = null;
    player.gold = 10_000;
    expect(() => aiShouldClaim(g.state, player, neutral.id)).not.toThrow();
  });

  it('keeps the shorter modes as options', () => {
    const { g, last } = engineHolding(9, gameMode('quick').config);
    claimAt(g, last.id);
    expect(g.state.victory).toBe('islandGoal');
    expect(g.state.log.at(-1)).toBe('Captain 0 claimed 10 islands for the crown!');
    const sprint = new GameEngine({ players, config: gameMode('sprint').config });
    expect(sprint.state.config).toMatchObject({ islandsToWin: 6, maxRounds: 20 });
  });

  it('describes each mode’s win condition', () => {
    expect(GAME_MODES.map((mode) => winConditionText(mode.config, 40))).toEqual([
      'hold all 40 new continents at once or be the last navigator afloat',
      'claim 10 islands, be the last navigator afloat, or have the highest net worth after 50 rounds',
      'claim 6 islands, be the last navigator afloat, or have the highest net worth after 20 rounds',
    ]);
  });
});
