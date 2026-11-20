import { describe, expect, it } from 'vitest';
import { createNationRoster, NATIONS } from './nations';
import { GameEngine } from './engine';

const picks = [{ name: 'You', nation: 'China' as const }];

describe('bounded nation rosters', () => {
  it('keeps legacy defaults and fills unpicked nations in order', () => {
    expect(createNationRoster(picks, 'hard')).toHaveLength(10);
    const roster = createNationRoster(picks, { totalPlayers: 4, difficulty: 'easy' });
    expect(roster.map((p) => p.nation)).toEqual(['China', 'Spain', 'Netherlands', 'England']);
    expect(roster.map((p) => p.isAI)).toEqual([false, true, true, true]);
    expect(roster.slice(1).every((p) => p.aiDifficulty === 'easy')).toBe(true);
    expect(createNationRoster(NATIONS.map((n) => ({ name: n.name, nation: n.name })), { totalPlayers: 10 }).every((p) => !p.isAI)).toBe(true);
    expect(createNationRoster(picks, { totalPlayers: 2 })).toHaveLength(2);
  });

  it.each([0, 1, 11, 2.5, NaN, Infinity])('rejects invalid total %s', (totalPlayers) => {
    expect(() => createNationRoster(picks, { totalPlayers })).toThrow('Total players must');
  });

  it('rejects empty, duplicate and excessive human picks', () => {
    expect(() => createNationRoster([], { totalPlayers: 4 })).toThrow('At least one');
    expect(() => createNationRoster([...picks, ...picks], { totalPlayers: 4 })).toThrow('Nation already picked');
    expect(() => createNationRoster(NATIONS.slice(0, 3).map((n) => ({ name: n.name, nation: n.name })), { totalPlayers: 2 })).toThrow('fewer than human');
  });
});

describe('reduced-player games', () => {
  const setup = () => new GameEngine({ players: createNationRoster(picks, { totalPlayers: 4 }), rng: () => 0 });
  function finish(game: GameEngine) {
    game.spinCompass();
    game.sail();
    game.currentPlayer.position = game.currentPlayer.homePort;
    game.resolveLanding();
  }

  it('gives every human and AI one turn per round, rotating the starting seat', () => {
    const game = setup();
    const turns: number[] = [];
    game.on((event) => { if (event.type === 'turnStarted') turns.push(event.playerId); });
    game.start();
    for (let i = 0; i < 7; i++) finish(game);
    expect(turns).toEqual([0, 1, 2, 3, 1, 2, 3, 0]);
    expect(game.state.players.map((p) => p.isAI)).toEqual([false, true, true, true]);
    expect(game.state.owners.every((owner) => owner === null)).toBe(true);
  });

  it('skips eliminated seats and awards last-afloat victory', () => {
    const game = setup();
    game.state.players[1].bankrupt = true;
    finish(game);
    expect(game.state.currentPlayer).toBe(2);
    game.state.players[2].bankrupt = true;
    game.state.players[3].bankrupt = true;
    game.state.currentPlayer = 0;
    finish(game);
    expect(game.state.winner).toBe(0);
    expect(game.state.victory).toBe('lastAfloat');
  });

  it('requires all islands, not all nations, for full occupation', () => {
    const game = setup();
    for (const node of game.state.map) if (node.kind === 'island') game.state.owners[node.id] = 0;
    finish(game);
    expect(game.state.winner).toBe(0);
    expect(game.state.victory).toBe('everyContinent');
  });

  it('handles ports of absent nations and rewards the home navigator', () => {
    const game = setup();
    const player = game.currentPlayer;
    const absent = game.state.map.find((node) => node.kind === 'port' && !game.state.players.some((p) => p.homePort === node.id))!;
    const before = player.gold;
    game.state.phase = 'moving';
    player.position = absent.id;
    game.resolveLanding();
    expect(player.gold).toBeLessThan(before);
    game.state.currentPlayer = 0;
    game.state.owners[game.state.map.find((node) => node.kind === 'island')!.id] = 0;
    const taxed = player.gold;
    finish(game);
    expect(player.gold).toBeGreaterThan(taxed);
    expect(player.rank).toBeGreaterThan(0);
  });
});
