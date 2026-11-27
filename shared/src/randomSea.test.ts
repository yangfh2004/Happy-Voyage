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

function stageSalvageStart(game: GameEngine, kind: MapNode['kind']) {
  const { position } = game.currentPlayer;
  game.state.map[position] = { ...game.state.map[position], kind };
}

describe('random sea encounters', () => {
  it('advances exactly once when a hazard bankrupts a fleet sailing to Skeleton Island', () => {
    const { game, events, sail, roll } = voyage();
    const player = game.currentPlayer;
    game.state.players.push({ ...player, id: 1, name: 'Next', position: 4 });
    game.state.players.push({ ...player, id: 2, name: 'Last', position: 5 });
    game.state.map[2] = { ...game.state.map[2], kind: 'special', special: 'skeleton' };
    roll([0, 0.25]);
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
    expect(game.state.owners[2]).toBe(0);
    expect(game.state.phase).toBe('awaitingBuild');
    expect(events.findIndex((e) => e.type === 'seaEvent')).toBeLessThan(events.findIndex((e) => e.type === 'claimed'));
  });

  it('can roll no encounter and never rolls at a port', () => {
    const { game, events, sail, roll } = voyage();
    sail();
    expect(events.some((e) => e.type === 'seaEvent')).toBe(false);
    game.currentPlayer.position = 14;
    roll(0);
    sail();
    expect(events.some((e) => e.type === 'seaEvent')).toBe(false);
  });

  it.each([
    [SEA_RULES.encounterChance, 0.99, undefined],
    [0.19, 0, 'pirates'],
  ] as const)('settles a blank sea landing without a salvage prompt with encounter roll %s and table roll %s', (chance, outcome, event) => {
    const { game, events, sail, roll } = voyage();
    game.state.map[2] = { id: 2, x: 20, y: 0, kind: 'sea', name: 'Open water' };
    game.state.hoardNode = 2;
    game.currentPlayer.escortProtection = true;
    const gold = game.currentPlayer.gold;
    roll([chance, outcome]);
    sail();
    expect(game.state.phase).toBe('awaitingSpin');
    expect(events.filter((e) => e.type === 'seaEvent')).toMatchObject(event ? [{ event }] : []);
    expect(game.state.hoardNode).toBe(2);
    expect(game.currentPlayer.gold).toBe(gold);
    expect(game.currentPlayer.position).toBe(2);
    expect(game.state.owners[2]).toBeNull();
  });

  it.each([
    [0, 0, 110],
    [0.99, 0.5, 0],
    [0.99, 0, 413],
  ])('settles a pre-spin haul for rolls %s and %s', (u, v, reward) => {
    const { game, events, roll } = voyage();
    const player = game.currentPlayer;
    const fee = SEA_RULES.wreckSalvageFee;
    player.gold = fee;
    stageSalvageStart(game, 'sea');
    roll([u, v]);
    game.salvageWreck();
    expect(game.state.phase).toBe('awaitingSpin');
    expect(game.currentPlayer).toBe(player);
    expect(player.gold).toBe(reward);
    expect(player.bankrupt).toBe(false);
    expect(events).toContainEqual({ type: 'seaEvent', playerId: player.id, event: 'treasure', outcome: 'gold', gold: reward, salvageFee: fee });
    expect(() => game.salvageWreck()).toThrow('Already salvaged this turn');
  });

  it.each(['port', 'island', 'special'] as const)('rejects manual and AI salvage when starting at a %s', (kind) => {
    const { game } = voyage();
    stageSalvageStart(game, kind);
    const { gold } = game.currentPlayer;
    expect(game.canSalvageWreck()).toBe(false);
    expect(() => game.salvageWreck()).toThrow('Salvage requires starting the turn at sea');
    game.decideForAI();
    expect(game.currentPlayer.gold).toBe(gold);
    expect(game.state.salvageUsed).toBe(false);
  });

  it('does not unlock salvage after exchanging positions from port to sea', () => {
    const { game } = voyage();
    const player = game.currentPlayer;
    game.state.map[2] = { ...game.state.map[2], kind: 'sea' };
    game.state.players.push({ ...player, id: 1, position: 2 });
    player.strategies = ['exchange'];
    game.useStrategy('exchange', 1);
    expect(player.position).toBe(2);
    expect(game.state.phase).toBe('awaitingSpin');
    expect(game.canSalvageWreck()).toBe(false);
    expect(() => game.salvageWreck()).toThrow('Salvage requires starting the turn at sea');
  });

  it('unlocks salvage on the next turn after landing on a sea event', () => {
    const { game, sail } = voyage();
    game.state.map[2] = { ...game.state.map[2], kind: 'event', event: 'tradeWind' };
    expect(game.canSalvageWreck()).toBe(false);
    sail();
    expect(game.canSalvageWreck()).toBe(true);
    game.salvageWreck();
    expect(game.state.salvageUsed).toBe(true);
  });

  it('resets salvage at the next turn and rejects it after spinning', () => {
    const { game, sail, roll } = voyage();
    stageSalvageStart(game, 'sea');
    game.state.map[2] = { ...game.state.map[2], kind: 'sea' };
    roll([0, 0]);
    game.salvageWreck();
    game.spinCompass();
    expect(() => game.salvageWreck()).toThrow('Expected phase awaitingSpin');
    sail();
    expect(game.canSalvageWreck()).toBe(true);
  });

  it.each([true, false])('spins without charging for salvage (can afford: %s)', (canAfford) => {
    const { game, events } = voyage();
    stageSalvageStart(game, 'sea');
    const player = game.currentPlayer;
    player.gold = SEA_RULES.wreckSalvageFee - Number(!canAfford);
    const before = player.gold;
    if (!canAfford) {
      expect(() => game.salvageWreck()).toThrow('Not enough gold');
      game.decideForAI();
    }
    game.spinCompass();
    expect(player.gold).toBe(before);
    expect(events.some((event) => event.type === 'seaEvent')).toBe(false);
  });

  it('uses a seeded normal spread with occasional large hauls', () => {
    const { game, events, roll } = voyage();
    stageSalvageStart(game, 'sea');
    let seed = 42;
    const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    const rewards = Array.from({ length: 4000 }, () => {
      game.state.salvageUsed = false;
      game.currentPlayer.gold = SEA_RULES.wreckSalvageFee;
      roll([next(), next()]);
      game.salvageWreck();
      const event = events.at(-1);
      return event?.type === 'seaEvent' ? event.gold! : -1;
    });
    const mean = rewards.reduce((sum, reward) => sum + reward, 0) / rewards.length;
    expect(mean).toBeGreaterThan(110);
    expect(mean).toBeLessThan(125);
    expect(rewards.filter((reward) => reward === 0).length).toBeGreaterThan(400);
    expect(rewards.filter((reward) => reward >= 300).length).toBeGreaterThan(70);
    expect(rewards.filter((reward) => reward >= 300).length).toBeLessThan(180);
    expect(rewards.every((reward) => reward >= 0 && Number.isInteger(reward))).toBe(true);
  });

  it('guarantees an encounter on an open-sea station even above the ordinary chance', () => {
    const { game, events, sail } = voyage();
    game.state.map[2] = { ...game.state.map[2], kind: 'event', event: 'openSea', name: 'Uncharted Waters' };
    sail();
    expect(events.filter((e) => e.type === 'seaEvent')).toHaveLength(1);
    expect(events.find((e) => e.type === 'seaEvent')).toMatchObject({ event: 'turtle' });
    expect(game.state.phase).toBe('awaitingSpin');
  });

  it('also rolls when a navigation card moves the fleet to open sea', () => {
    const { game, events } = voyage();
    game.state.map[2] = { ...game.state.map[2], kind: 'event', event: 'openSea' };
    game.currentPlayer.strategies = ['navigate'];
    game.useStrategy('navigate', 2);
    expect(events.find((e) => e.type === 'seaEvent')).toMatchObject({ event: 'turtle' });
  });

  it('does not trigger roaming hazards when passing by them', () => {
    const { game, events, sail } = voyage();
    const player = game.currentPlayer;
    const gold = player.gold;
    const durabilities = player.fleet.map((s) => s.durability);
    game.state.roamers = [
      { id: 0, kind: 'smallMonster', node: 1 },
      { id: 1, kind: 'pirates', node: 2 },
    ];
    sail(3);
    expect(events.some((e) => e.type === 'seaEvent')).toBe(false);
    expect(player.gold).toBe(gold);
    expect(player.fleet.map((s) => s.durability)).toEqual(durabilities);
    expect(game.state.roamers.map((r) => r.node)).toEqual([1, 2]);
    expect(game.state.owners[3]).toBe(0);
  });

  it('triggers a roaming hazard on landing before the random roll and resurfaces away from fleets', () => {
    const { game, events, sail } = voyage();
    game.state.roamers = [{ id: 0, kind: 'smallMonster', node: 2 }];
    sail();
    expect(events.filter((e) => e.type === 'seaEvent')).toMatchObject([{ event: 'smallMonster' }]);
    expect(game.state.roamers[0].node).not.toBe(2);
    expect(game.state.players.map((p) => p.position)).not.toContain(game.state.roamers[0].node);
    expect(game.state.owners[2]).toBe(0);
    expect(game.state.phase).toBe('awaitingBuild');
  });

  it('triggers a roaming hazard when navigating directly onto its space', () => {
    const { game, events } = voyage();
    game.state.roamers = [{ id: 0, kind: 'smallMonster', node: 2 }];
    game.currentPlayer.strategies = ['navigate'];
    game.useStrategy('navigate', 2);
    expect(events.filter((e) => e.type === 'seaEvent')).toMatchObject([{ event: 'smallMonster' }]);
    expect(game.state.roamers[0].node).not.toBe(2);
    expect(game.state.owners[2]).toBe(0);
  });

  it('ignores fleet-loss defeats when resurfacing and skips defeated navigators', () => {
    const { game, sail } = voyage();
    const player = game.currentPlayer;
    game.state.players.push({ ...player, id: 1, name: 'Defeated', position: 3, fleet: [], fleetLost: true });
    game.state.players.push({ ...player, id: 2, name: 'Survivor', position: 4 });
    for (const node of game.state.map.slice(4)) node.kind = 'port';
    game.state.roamers = [{ id: 0, kind: 'smallMonster', node: 2 }];
    sail();
    expect(game.state.roamers[0].node).toBe(3);
    game.finishBuilding();
    expect(game.state.currentPlayer).toBe(2);
  });

  it('moves roamers one to three route stops after the full round', () => {
    const { game, sail } = voyage();
    game.state.roamers = [{ id: 0, kind: 'pirates', node: 8 }];
    sail();
    game.finishBuilding();
    expect(game.state.round).toBe(2);
    expect(game.state.roamers[0].node).toBe(11);
  });

  it('turns roamers away from ports rather than entering them', () => {
    const { game, sail } = voyage(0.99);
    game.state.roamers = [{ id: 0, kind: 'pirates', node: 15 }];
    sail();
    game.finishBuilding();
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
      expect(game.state.phase).toBe('awaitingSpin');
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
    expect(game.state.owners[2]).toBe(0);
    expect(game.state.phase).toBe('awaitingBuild');
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
