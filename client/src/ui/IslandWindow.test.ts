import { GameEngine, type GameState, type SpecialKind } from '@happy-voyage/shared';
import { describe, expect, it } from 'vitest';
import { islandWindowFor } from './IslandWindow';

function visit(island: SpecialKind, phase: GameState['phase']) {
  const game = new GameEngine({ players: [{ name: 'Human', color: 0 }, { name: 'AI', color: 1, isAI: true }] });
  const node = game.state.map.find((node) => node.special === island)!;
  game.state.players.forEach((player) => { player.position = node.id; });
  game.state.phase = phase;
  return game.state;
}

describe('islandWindowFor', () => {
  it.each([
    ['treasure', 'awaitingLottery'],
  ] as const)('opens only for the human at the helm at %s', (island, phase) => {
    const state = visit(island, phase);
    expect(islandWindowFor(state, true)).toBe(island);
    expect(islandWindowFor(state, false)).toBeNull();
    state.currentPlayer = 1;
    expect(islandWindowFor(state, true)).toBeNull();
  });

  it('does not cover movement or ordinary colony actions', () => {
    expect(islandWindowFor(visit('treasure', 'moving'), true)).toBeNull();
    expect(islandWindowFor(visit('treasure', 'awaitingClaim'), true)).toBeNull();
    expect(islandWindowFor(visit('mist', 'awaitingLottery'), true)).toBeNull();
  });
});
