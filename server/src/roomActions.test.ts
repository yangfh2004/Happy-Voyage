import { expect, it } from 'vitest';
import { GameEngine } from '@happy-voyage/shared';
import { applyRoomAction } from './roomActions';

function game() {
  return new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: false }], config: { startingStrategies: 0 } });
}

it('accepts rival and rival colony strategy targets through online actions', () => {
  const g = game();
  g.currentPlayer.strategies = ['plunder', 'scorch'];
  const gold = g.currentPlayer.gold;
  applyRoomAction(g, ['useStrategy', 'plunder', 1]);
  expect(g.currentPlayer.gold).toBeGreaterThan(gold);
  g.state.strategyUsed = false;
  const node = g.state.map.find((n) => n.kind === 'island')!.id;
  g.state.owners[node] = 1;
  g.state.stockpiles[node].iron = 20;
  applyRoomAction(g, ['useStrategy', 'scorch', node]);
  expect(g.state.stockpiles[node].iron).toBe(0);
});

it('rejects malformed, missing, self and extra targets without consuming cards', () => {
  const g = game();
  g.currentPlayer.strategies = ['plunder'];
  for (const args of [[], [1.5], ['1'], [0], [99], [1, 2]]) {
    expect(() => applyRoomAction(g, ['useStrategy', 'plunder', ...args])).toThrow();
    expect(g.currentPlayer.strategies).toEqual(['plunder']);
  }
});
