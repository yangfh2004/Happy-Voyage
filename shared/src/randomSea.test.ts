import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { SEA_RULES } from './seaRules';
import { fleetQuantity } from './barter';
import type { GameEvent, MapNode } from './types';

function voyage(roll = 0.99) {
  let value = roll;
  let values: number[] = [];
  const map: MapNode[] = Array.from({ length: 16 }, (_, id) => ({ id, name: `Stop ${id}`, kind: id === 0 ? 'port' : 'island', price: 100, toll: 30, x: id * 10, y: 0 }));
  const game = new GameEngine({ map, players: [{ name: 'Captain', color: 0, isAI: true }], rng: () => values.shift() ?? value, config: { startingStrategies: 0, maxRounds: 10 } });
  game.state.roamers = [];
  const events: GameEvent[] = [];
  game.on((event) => events.push(event));
  const sail = (steps = 2) => {
    game.state.phase = 'spinning';
    game.state.lastSpin = steps;
    game.sail();
    game.resolveLanding();
  };
  return { game, events, sail, roll: (n: number | number[]) => { if (Array.isArray(n)) values = [...n]; else value = n; } };
}

describe('random sea encounters', () => {
  it('advances exactly once when a hazard bankrupts a fleet sailing to Skeleton Island', () => {
    const { game, events, sail } = voyage();
    const player = game.currentPlayer;
    game.state.players.push({ ...player, id: 1, name: 'Next', position: 4 });
    game.state.players.push({ ...player, id: 2, name: 'Last', position: 5 });
    game.state.map[2] = { ...game.state.map[2], kind: 'special', special: 'skeleton' };
    game.state.roamers = [{ id: 0, kind: 'smallMonster', node: 1 }];
    player.gold = 1;
    sail();
    expect(player.bankrupt).toBe(true);
    expect(game.state.currentPlayer).toBe(1);
    expect(game.state.phase).toBe('awaitingSpin');
    expect(events.some((e) => e.type === 'marketOffered')).toBe(false);
    expect(events.filter((e) => e.type === 'turnStarted')).toHaveLength(1);
  });

  it.each(['bankrupt', 'fleetLost', 'emptyFleet'] as const)('skips landing after merchant Leave for %s fleets', (defeat) => {
    const { game, events, sail, roll } = voyage();
    const player = game.currentPlayer;
    game.state.players.push({ ...player, id: 1, name: 'Next', position: 4 });
    game.state.players.push({ ...player, id: 2, name: 'Last', position: 5 });
    game.state.map[2] = { ...game.state.map[2], kind: 'special', special: 'skeleton' };
    roll([0, 0.75]);
    sail();
    expect(game.state.phase).toBe('awaitingMerchant');
    if (defeat === 'emptyFleet') player.fleet = [];
    else player[defeat] = true;
    game.declineMerchant();
    expect(game.state.currentPlayer).toBe(1);
    expect(game.state.phase).toBe('awaitingSpin');
    expect(game.state.pendingMerchant).toBeNull();
    expect(events.some((e) => e.type === 'marketOffered')).toBe(false);
    expect(events.filter((e) => e.type === 'turnStarted')).toHaveLength(1);
  });

  it('rolls an encounter before the destination landing in the same turn', () => {
    const { game, events, sail } = voyage(0.01);
    game.currentPlayer.revivalProtection = true;
    sail();
    expect(events.filter((e) => e.type === 'seaEvent')).toMatchObject([{ event: 'pirates', outcome: 'protected' }]);
    expect(game.state.phase).toBe('awaitingClaim');
    expect(events.findIndex((e) => e.type === 'seaEvent')).toBeLessThan(events.findIndex((e) => e.type === 'claimOffered'));
  });

  it('can roll no encounter and never rolls at a port', () => {
    const { game, events, sail, roll } = voyage();
    sail();
    expect(events.some((e) => e.type === 'seaEvent')).toBe(false);
    game.decline();
    game.currentPlayer.position = 14;
    roll(0);
    sail();
    expect(events.some((e) => e.type === 'seaEvent')).toBe(false);
  });

  it('guarantees an encounter on an open-sea station even above the ordinary chance', () => {
    const { game, events, sail } = voyage();
    game.state.map[2] = { ...game.state.map[2], kind: 'event', event: 'openSea', name: 'Uncharted Waters' };
    sail();
    expect(events.filter((e) => e.type === 'seaEvent')).toHaveLength(1);
    expect(events.find((e) => e.type === 'seaEvent')).toMatchObject({ event: 'turtle' });
  });

  it('also rolls when a navigation card moves the fleet to open sea', () => {
    const { game, events } = voyage();
    game.state.map[2] = { ...game.state.map[2], kind: 'event', event: 'openSea' };
    game.currentPlayer.strategies = ['navigate'];
    game.useStrategy('navigate', 2);
    expect(events.find((e) => e.type === 'seaEvent')).toMatchObject({ event: 'turtle' });
  });

  it('intercepts the sailed path before the random roll and resurfaces away from fleets', () => {
    const { game, events, sail } = voyage();
    game.state.roamers = [{ id: 0, kind: 'smallMonster', node: 1 }];
    sail();
    expect(events.filter((e) => e.type === 'seaEvent')).toMatchObject([{ event: 'smallMonster' }]);
    expect(game.state.roamers[0].node).not.toBe(1);
    expect(game.state.players.map((p) => p.position)).not.toContain(game.state.roamers[0].node);
    expect(game.state.phase).toBe('awaitingClaim');
  });

  it('ignores fleet-loss defeats when resurfacing and skips defeated navigators', () => {
    const { game, sail } = voyage();
    const player = game.currentPlayer;
    game.state.players.push({ ...player, id: 1, name: 'Defeated', position: 3, fleet: [], fleetLost: true });
    game.state.players.push({ ...player, id: 2, name: 'Survivor', position: 4 });
    for (const node of game.state.map.slice(4)) node.kind = 'port';
    game.state.roamers = [{ id: 0, kind: 'smallMonster', node: 1 }];
    sail();
    expect(game.state.roamers[0].node).toBe(3);
    game.decline();
    expect(game.state.currentPlayer).toBe(2);
  });

  it('moves roamers one to three route stops after the full round', () => {
    const { game, sail } = voyage();
    game.state.roamers = [{ id: 0, kind: 'pirates', node: 8 }];
    sail();
    expect(game.state.roamers[0].node).toBe(8);
    game.decline();
    expect(game.state.round).toBe(2);
    expect(game.state.roamers[0].node).toBe(11);
  });

  it('turns roamers away from ports rather than entering them', () => {
    const { game, sail } = voyage(0.99);
    game.state.roamers = [{ id: 0, kind: 'pirates', node: 15 }];
    sail();
    game.decline();
    expect(game.state.roamers[0].node).toBe(12);
  });

  it('does not reroll after a wyvern or whirlpool relocation', () => {
    for (const encounter of ['wyvern', 'whirlpool'] as const) {
      const { game, events, sail, roll } = voyage();
      game.state.map[2] = { ...game.state.map[2], kind: 'event', event: 'openSea' };
      game.state.map[6] = { ...game.state.map[6], kind: 'event', event: 'openSea' };
      roll(encounter === 'wyvern' ? [0.9] : [0.4, 0.9, 0.9]);
      sail();
      if (encounter === 'wyvern') game.wyvernFly(6);
      expect(game.state.phase).toBe('moving');
      game.resolveLanding();
      expect(game.currentPlayer.position).toBe(6);
      expect(events.filter((e) => e.type === 'seaEvent')).toHaveLength(1);
    }
  });

  it('keeps seeded encounters and roamer placement deterministic', () => {
    const run = (seed: number) => {
      const game = new GameEngine({ players: [{ name: 'AI', color: 0, isAI: true }], rng: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32), config: { maxRounds: 5 } });
      const events: GameEvent[] = [];
      game.on((event) => events.push(event));
      for (let i = 0; i < 300 && game.state.phase !== 'gameOver'; i++) {
        if (game.state.phase === 'awaitingSpin') {
          game.decideForAI();
          if (game.state.phase === 'awaitingSpin') game.spinCompass();
        }
        else if (game.state.phase === 'moving') game.resolveLanding();
        else if (game.state.phase === 'spinning') game.sail();
        else game.decideForAI();
      }
      expect(game.state.phase).toBe('gameOver');
      return { events, roamers: game.state.roamers };
    };
    expect(run(42)).toEqual(run(42));
    expect(run(17)).not.toEqual(run(42));
  });

  it('lets a merchant buy and sell, then resumes the original island landing', () => {
    const { game, sail, roll } = voyage(0.1);
    game.currentPlayer.fleet[0].cargo.Silk = 2;
    roll([0.01, 0.85, 0.5]);
    sail();
    if (game.state.phase !== 'awaitingMerchant') throw new Error('Merchant did not open');
    const player = game.currentPlayer;
    const stock = game.state.pendingMerchant!.stock!;
    game.acceptMerchant();
    const before = player.gold;
    const cargo = fleetQuantity(player, stock.good);
    game.buyMerchant(2);
    expect(player.gold).toBe(before - 2 * stock.unitPrice);
    expect(fleetQuantity(player, stock.good)).toBe(cargo + 2);
    expect(stock.quantity).toBe(SEA_RULES.merchantUnits - 2);
    expect(game.state.phase).toBe('awaitingMerchant');
    game.declineMerchant();
    expect(game.state.phase).toBe('awaitingClaim');
  });

  it('validates merchant quantity, capacity and gold without changing cargo', () => {
    const { game } = voyage();
    game.currentPlayer.position = 2;
    game.state.map[2] = { ...game.state.map[2], kind: 'event', event: 'merchant' };
    game.state.phase = 'moving';
    game.resolveLanding();
    for (const quantity of [0, -1, 1.5, NaN, 6]) expect(() => game.buyMerchant(quantity)).toThrow('Invalid merchant quantity');
    for (const ship of game.currentPlayer.fleet) ship.cargo.iron = ship.cargoCapacity;
    expect(() => game.buyMerchant(1)).toThrow('Not enough cargo capacity');
    game.currentPlayer.fleet[0].cargo = {};
    game.currentPlayer.gold = 0;
    expect(() => game.buyMerchant(1)).toThrow('Not enough gold');
    expect(game.state.pendingMerchant!.stock!.quantity).toBe(SEA_RULES.merchantUnits);
  });

  it('skips an empty merchant window when there is no possible trade', () => {
    const { game, events } = voyage();
    game.currentPlayer.position = 2;
    game.currentPlayer.gold = 0;
    game.state.map[2] = { ...game.state.map[2], kind: 'event', event: 'merchant' };
    game.state.phase = 'moving';
    game.resolveLanding();
    expect(game.state.phase).toBe('awaitingSpin');
    expect(events.find((e) => e.type === 'seaEvent')).toMatchObject({ event: 'merchant', outcome: 'noTrade' });
  });
});
