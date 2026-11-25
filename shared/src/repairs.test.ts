import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { SEA_HAZARD_DAMAGE } from './rules';

function game() {
  return new GameEngine({ players: [0, 1].map((id) => ({ name: `Captain ${id}`, color: id, isAI: false })), rng: () => 0 });
}

function land(engine: GameEngine, id: number) {
  engine.currentPlayer.position = id;
  engine.state.phase = 'moving';
  engine.resolveLanding();
}

describe('fleet repairs', () => {
  it.each([1400, 100, 7, 1, 0])('repairs only affordable durability with %ig', (gold) => {
    const engine = game();
    const player = engine.currentPlayer;
    player.fleet.splice(5);
    expect(player.fleet).toHaveLength(5);
    player.fleet.forEach((ship, index) => { ship.durability -= index + 1; });
    player.gold = gold;
    const events: unknown[] = [];
    engine.on((event) => events.push(event));
    land(engine, engine.state.map.find((node) => node.special === 'revival')!.id);
    const points = Math.min(15, Math.floor(gold / 2));
    expect(player.fleet.reduce((sum, ship) => sum + ship.maxDurability - ship.durability, 0)).toBe(15 - points);
    expect(player.fleet[0].durability).toBe(player.fleet[0].maxDurability - (points ? 0 : 1));
    expect(player.gold).toBe(gold - points * 2);
    expect(player.revivalProtection).toBe(false);
    expect(engine.currentPlayer).toBe(player);
    expect(engine.state.phase).toBe('awaitingRevival');
    expect(engine.state.revivalReport).toEqual({ damage: 15, restored: points, goldSpent: points * 2 });
    if (points) expect(events).toContainEqual(expect.objectContaining({ type: 'goldChanged', reason: 'revival repairs', delta: -points * 2 }));
    else expect(events).not.toContainEqual(expect.objectContaining({ reason: 'revival repairs' }));
    expect(engine.state.log.join(' ')).toContain(`restored ${points}/15 durability`);
    engine.leaveRevivalIsland();
    expect(engine.currentPlayer).not.toBe(player);
    expect(engine.state.revivalReport).toBeNull();
    expect(player.gold).toBe(gold - points * 2);
    expect(player.revivalProtection).toBe(false);
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

  it.each([1400, 3, 0])('repairs AI fleets with %ig without waiting for a report', (gold) => {
    const engine = game();
    const player = engine.currentPlayer;
    player.isAI = true;
    player.gold = gold;
    const ship = player.fleet[0];
    ship.durability -= 2;
    land(engine, engine.state.map.find((node) => node.special === 'revival')!.id);
    expect(engine.currentPlayer).not.toBe(player);
    expect(engine.state.phase).toBe('awaitingSpin');
    expect(engine.state.revivalReport).toBeNull();
    const points = Math.min(2, Math.floor(gold / 2));
    expect(ship.durability).toBe(ship.maxDurability - 2 + points);
    expect(player.gold).toBe(gold - points * 2);
    expect(player.revivalProtection).toBe(false);
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

  it.each(['shipyard', 'repairYard'] as const)('repairs only owner docked ships with a %s at turn start, including subsequent turns', (yard) => {
    const engine = game();
    const { state } = engine;
    const islands = state.map.filter((node) => node.kind === 'island').slice(0, 4);
    for (const [index, node] of islands.entries()) {
      state.owners[node.id] = index === 2 ? 1 : 0;
      if (index !== 1) state.buildings[node.id][yard] = 1;
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

  it('repairs a ship docked at a shipyard on the next owner turn, not on arrival', () => {
    const engine = game();
    const { state, currentPlayer: player } = engine;
    const colony = state.map.find((node) => node.kind === 'island')!.id;
    state.owners[colony] = player.id;
    state.buildings[colony].shipyard = 1;
    land(engine, colony);
    const ship = player.fleet[0];
    ship.durability = 1;
    const gold = player.gold;
    expect(() => engine.dockShip(-1)).toThrow('Ship not available here');
    engine.dockShip(ship.id);
    expect(ship.durability).toBe(1);
    engine.finishBuilding();
    expect(ship.durability).toBe(1);
    land(engine, engine.currentPlayer.homePort);
    expect(engine.currentPlayer).toBe(player);
    expect(ship.durability).toBe(ship.maxDurability);
    expect(player.gold).toBe(gold + 30);
    land(engine, colony);
    engine.boardShip(ship.id);
    engine.finishBuilding();
    land(engine, engine.currentPlayer.homePort);
    expect(state.docks[colony]).toEqual([]);
  });
});
