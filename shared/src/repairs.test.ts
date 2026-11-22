import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { REPAIR_GOLD_PER_POINT, SEA_HAZARD_DAMAGE } from './rules';

function game() {
  return new GameEngine({ players: [0, 1].map((id) => ({ name: `Captain ${id}`, color: id, isAI: false })), rng: () => 0 });
}

function land(engine: GameEngine, id: number) {
  engine.currentPlayer.position = id;
  engine.state.phase = 'moving';
  engine.resolveLanding();
}

describe('fleet repairs', () => {
  it.each([100, 7, 0])('repairs affordable points in fleet order with %ig', (gold) => {
    const engine = game();
    const player = engine.currentPlayer;
    const [first, second, sound] = player.fleet;
    first.durability -= 2;
    second.durability -= 4;
    player.gold = gold;
    const events: unknown[] = [];
    engine.on((event) => events.push(event));
    land(engine, engine.state.map.find((node) => node.special === 'revival')!.id);
    const points = Math.min(6, Math.floor(gold / REPAIR_GOLD_PER_POINT));
    expect(first.durability).toBe(first.maxDurability - 2 + Math.min(points, 2));
    expect(second.durability).toBe(second.maxDurability - 4 + Math.max(0, points - 2));
    expect(sound.durability).toBe(sound.maxDurability);
    expect(player.gold).toBe(gold - points * REPAIR_GOLD_PER_POINT);
    expect(player.revivalProtection).toBe(true);
    expect(engine.currentPlayer).toBe(player);
    expect(engine.state.phase).toBe('awaitingRevival');
    expect(engine.state.revivalReport).toEqual({ damage: 6, restored: points, goldSpent: points * REPAIR_GOLD_PER_POINT });
    expect(events).toContainEqual(expect.objectContaining({ reason: 'revival repairs' }));
    expect(engine.state.log.join(' ')).toContain(`restored ${points}/6 durability`);
    engine.leaveRevivalIsland();
    expect(engine.currentPlayer).not.toBe(player);
    expect(engine.state.revivalReport).toBeNull();
    expect(player.gold).toBe(gold - points * REPAIR_GOLD_PER_POINT);
    expect(player.revivalProtection).toBe(true);
    expect(() => engine.leaveRevivalIsland()).toThrow();
  });

  it('charges nothing for a sound or empty fleet', () => {
    for (const empty of [false, true]) {
      const engine = game();
      const player = engine.currentPlayer;
      if (empty) player.fleet = [];
      const gold = player.gold;
      land(engine, engine.state.map.find((node) => node.special === 'revival')!.id);
      expect(player.gold).toBe(gold);
      expect(engine.state.revivalReport).toEqual({ damage: 0, restored: 0, goldSpent: 0 });
      expect(engine.state.log.join(' ')).toContain('fleet already sound');
    }
  });

  it('repairs and protects AI fleets without waiting for a report', () => {
    const engine = game();
    const player = engine.currentPlayer;
    player.isAI = true;
    const gold = player.gold;
    const ship = player.fleet[0];
    ship.durability -= 2;
    land(engine, engine.state.map.find((node) => node.special === 'revival')!.id);
    expect(engine.currentPlayer).not.toBe(player);
    expect(engine.state.phase).toBe('awaitingSpin');
    expect(engine.state.revivalReport).toBeNull();
    expect(ship.durability).toBe(ship.maxDurability);
    expect(player.gold).toBe(gold - 2 * REPAIR_GOLD_PER_POINT);
    expect(player.revivalProtection).toBe(true);
  });

  it.each(['storm', 'whirlpool'] as const)('%s damages sailing ships, unless protected', (event) => {
    for (const protectedFromHazards of [false, true]) {
      const engine = game();
      const player = engine.currentPlayer;
      const [ship, fragile] = player.fleet;
      fragile.durability = 3;
      player.revivalProtection = protectedFromHazards;
      const node = engine.state.map.find((node) => node.event === event) ?? engine.state.map.find((node) => node.event === 'openSea')!;
      node.event = event;
      land(engine, node.id);
      expect(ship.durability).toBe(ship.maxDurability - (protectedFromHazards ? 0 : SEA_HAZARD_DAMAGE));
      expect(fragile.durability).toBe(protectedFromHazards ? 3 : 0);
    }
  });

  it('repairs only owner docked ships with a yard at turn start, including subsequent turns', () => {
    const engine = game();
    const { state } = engine;
    const islands = state.map.filter((node) => node.kind === 'island').slice(0, 4);
    for (const [index, node] of islands.entries()) {
      state.owners[node.id] = index === 2 ? 1 : 0;
      if (index !== 1) state.buildings[node.id].repairYard = 1;
      const ship = engine.addShipToFleet(0, 'cargo');
      state.players[0].fleet.pop();
      ship.durability = 1;
      state.docks[node.id].push(ship);
    }
    const sailing = engine.addShipToFleet(0, 'cargo');
    sailing.durability = 1;
    const gold = state.players[0].gold;
    engine.start();
    for (const [index, node] of islands.entries()) {
      const ship = state.docks[node.id][0];
      expect(ship.durability).toBe(index === 0 || index === 3 ? ship.maxDurability : 1);
    }
    expect(sailing.durability).toBe(1);
    expect(state.players[0].gold).toBe(gold);
    expect(state.log.join(' ')).toContain('docked ship durability for free');
    land(engine, state.players[0].homePort);
    const rivalDock = state.docks[islands[2].id][0];
    expect(rivalDock.durability).toBe(rivalDock.maxDurability);
  });
});
