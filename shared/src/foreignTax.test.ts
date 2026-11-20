import { describe, expect, it } from 'vitest';
import { GameEngine, SEA_RULES } from './engine';
import { shipSalePrice } from './ships';

function setup(isAI = false) {
  const game = new GameEngine({ players: [
    { name: 'Visitor', nation: 'Spain', color: 0, isAI },
    { name: 'Host', nation: 'England', color: 1, isAI: false },
  ] });
  return { game, visitor: game.state.players[0], host: game.state.players[1] };
}

function land(game: GameEngine, port: number) {
  game.currentPlayer.position = port;
  game.state.phase = 'moving';
  game.resolveLanding();
}

describe('foreign port tax', () => {
  it('transfers the full tax without seizing ships when gold is sufficient', () => {
    const { game, visitor, host } = setup();
    const before = host.gold;
    visitor.gold = SEA_RULES.foreignTax;
    land(game, host.homePort);
    expect(visitor.gold).toBe(0);
    expect(visitor.bankrupt).toBe(false);
    expect(visitor.fleet).toHaveLength(3);
    expect(host.gold).toBe(before + SEA_RULES.foreignTax);
    expect(game.state.log.some((line) => line.includes('pays 40g foreign tax'))).toBe(true);
  });

  it.each([false, true])('seizes the cheapest ship for a shortfall (AI=%s)', (isAI) => {
    const { game, visitor, host } = setup(isAI);
    const cheapest = [...visitor.fleet].sort((a, b) => shipSalePrice(a) - shipSalePrice(b))[0];
    cheapest.cargo.iron = 2;
    visitor.gold = 5;
    const before = host.gold;
    land(game, host.homePort);
    expect(visitor.gold).toBe(0);
    expect(visitor.bankrupt).toBe(false);
    expect(visitor.fleet).toHaveLength(2);
    expect(host.fleet).toContain(cheapest);
    expect(cheapest.cargo.iron).toBe(2);
    expect(host.gold).toBe(before + 5);
    expect(game.state.log.some((line) => line.includes('is seized'))).toBe(true);
  });

  it('takes multiple ships at their condition-adjusted resale value', () => {
    const { game, visitor, host } = setup();
    visitor.gold = 0;
    visitor.fleet.forEach((ship) => { ship.durability = ship.maxDurability * 0.2; });
    land(game, host.homePort);
    expect(visitor.fleet).toHaveLength(1);
    expect(host.fleet).toHaveLength(5);
    expect(visitor.bankrupt).toBe(false);
  });

  it('removes seized ships at unrepresented ports and bankrupts a shipless visitor', () => {
    const { game, visitor, host } = setup();
    visitor.gold = 0;
    visitor.fleet = [visitor.fleet[0]];
    const port = game.state.map.find((node) => node.kind === 'port' && node.id !== visitor.homePort && node.id !== host.homePort)!;
    land(game, port.id);
    expect(visitor.fleet).toHaveLength(0);
    expect(visitor.bankrupt).toBe(true);
    expect(host.fleet).toHaveLength(3);
    expect(game.state.log.some((line) => line.includes('seized by the crown'))).toBe(true);
  });

  it('handles worthless ships and unpaid debt through existing bankruptcy cleanup', () => {
    const { game, visitor, host } = setup();
    visitor.gold = 0;
    visitor.fleet.forEach((ship) => { ship.durability = 0; });
    const colony = game.state.map.find((node) => node.kind === 'island')!;
    game.state.owners[colony.id] = visitor.id;
    land(game, host.homePort);
    expect(visitor.bankrupt).toBe(true);
    expect(visitor.fleet).toHaveLength(0);
    expect(game.state.owners[colony.id]).toBeNull();
  });

  it('handles an empty fleet without looping', () => {
    const { game, visitor, host } = setup();
    visitor.gold = 0;
    visitor.fleet = [];
    land(game, host.homePort);
    expect(visitor.bankrupt).toBe(true);
  });

  it('charges nothing at the visitor’s own port even without gold', () => {
    const { game, visitor } = setup();
    visitor.gold = 0;
    land(game, visitor.homePort);
    expect(visitor.gold).toBe(0);
    expect(visitor.fleet).toHaveLength(3);
    expect(visitor.bankrupt).toBe(false);
  });
});
