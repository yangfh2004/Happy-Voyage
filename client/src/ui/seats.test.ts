import { describe, expect, it } from 'vitest';
import { createNationRoster, GameEngine } from '@happy-voyage/shared';
import { seatTag } from './seats';

describe('seat tags', () => {
  it('numbers human seats by id, even for copied player objects', () => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Ana', nation: 'Spain' }, { name: 'Bo', nation: 'China' }]) });
    expect(state.players.map((p) => seatTag(state.players, { ...p }))).toEqual(['P1', 'P2', ...Array(8).fill('AI')]);
  });

  it('says You in a solo game', () => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Ana', nation: 'Spain' }]) });
    expect(seatTag(state.players, state.players[0])).toBe('You');
  });
});
