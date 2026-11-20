import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, EVENT_GOLD, GameEngine } from './engine';
import type { Rng } from './compass';
import { createDefaultMap } from './map';

const spinTwo: Rng = () => 0;
const spinTwelve: Rng = () => 0.999;

function spinAndSail(engine: GameEngine): number[] {
  engine.spinCompass();
  return engine.sail();
}

const twoPlayers = [
  { name: 'You', color: 0xff0000, isAI: false },
  { name: 'Rival', color: 0x0000ff, isAI: true },
];

describe('GameEngine', () => {
  it('starts every navigator with distinct ships suited to each role', () => {
    const { state } = new GameEngine({ players: twoPlayers });
    const allShips = state.players.flatMap((player) => player.fleet);
    expect(new Set(allShips.map((ship) => ship.id)).size).toBe(allShips.length);
    expect(new Set(allShips.map((ship) => ship.name)).size).toBe(allShips.length);
    for (const { fleet } of state.players) {
      expect(fleet.map((ship) => ship.type)).toEqual(['warship', 'cargo', 'explorer']);
      const [warship, cargo, explorer] = fleet;
      expect(warship.firepower).toBeGreaterThan(Math.max(cargo.firepower, explorer.firepower));
      expect(cargo.cargoCapacity).toBeGreaterThan(Math.max(warship.cargoCapacity, explorer.cargoCapacity));
      expect(explorer.speed).toBeGreaterThan(Math.max(warship.speed, cargo.speed));
      for (const ship of fleet) {
        expect(ship.durability).toBe(ship.maxDurability);
        expect(ship.crewCapacity).toBeGreaterThan(0);
      }
    }
  });

  it('commissions uniquely named ships for the target fleet without reusing lost ship IDs', () => {
    const engine = new GameEngine({ players: twoPlayers });
    const player = engine.state.players[1];
    const events: unknown[] = [];
    engine.on((event) => events.push(event));

    const first = engine.addShipToFleet(player.id, 'cargo');
    expect(player.fleet.pop()).toBe(first);
    const second = engine.addShipToFleet(player.id, 'cargo');

    expect(second.id).toBe(first.id + 1);
    expect(second.name).toBe(`Cargo Ship ${second.id}`);
    expect(player.fleet).toContain(second);
    expect(engine.currentPlayer.fleet).not.toContain(second);
    expect(events).toEqual([
      { type: 'shipAdded', playerId: player.id, shipId: first.id },
      { type: 'shipAdded', playerId: player.id, shipId: second.id },
    ]);
  });

  it('serializes fleet contents, per-ship damage, and the next ship ID in game state', () => {
    const engine = new GameEngine({ players: twoPlayers, rng: spinTwo });
    const [first, second] = engine.state.players;
    const ship = engine.addShipToFleet(first.id, 'warship');
    ship.durability -= 20;
    expect(first.fleet[0].durability).toBe(ship.maxDurability);
    expect(second.fleet[0].durability).toBe(ship.maxDurability);

    spinAndSail(engine);
    engine.resolveLanding();
    engine.decline();

    const snapshot = JSON.parse(JSON.stringify(engine.state));
    expect(snapshot.players[0].fleet).toContainEqual(ship);
    expect(snapshot.players[1].fleet).toEqual(second.fleet);
    expect(snapshot.nextShipId).toBe(ship.id + 1);
  });

  it.each([
    ['treasure', 0, EVENT_GOLD.treasure.min],
    ['treasure', 0.999, EVENT_GOLD.treasure.max],
    ['storm', 0, -EVENT_GOLD.storm.min],
    ['storm', 0.999, -EVENT_GOLD.storm.max],
    ['tradeWind', 0, EVENT_GOLD.tradeWind.base],
  ] as const)('uses the published %s reward with rng %s', (event, rng, delta) => {
    const engine = new GameEngine({ players: twoPlayers, rng: () => rng });
    engine.state.map[2] = { ...engine.state.map[2], kind: 'event', event };
    engine.currentPlayer.position = 2;
    engine.state.phase = 'moving';
    engine.resolveLanding();
    expect(engine.state.players[0].gold).toBe(DEFAULT_CONFIG.startingGold + delta);
  });

  it('adds colony income to trade winds', () => {
    const engine = new GameEngine({ players: twoPlayers });
    engine.state.owners[1] = 0;
    engine.state.map[11] = { ...engine.state.map[11], kind: 'event', event: 'tradeWind' };
    engine.currentPlayer.position = 11;
    engine.state.phase = 'moving';
    engine.resolveLanding();
    expect(engine.state.players[0].gold).toBe(DEFAULT_CONFIG.startingGold + EVENT_GOLD.tradeWind.base + EVENT_GOLD.tradeWind.perColony);
  });

  it('announces a storm loss before bankruptcy and neutralizes colonies', () => {
    const engine = new GameEngine({ players: twoPlayers, rng: () => 0.999 });
    engine.currentPlayer.gold = 1;
    engine.state.map[7] = { ...engine.state.map[7], kind: 'event', event: 'storm' };
    engine.currentPlayer.position = 7;
    engine.state.owners[1] = 0;
    engine.state.phase = 'moving';
    const events: string[] = [];
    engine.on((event) => events.push(event.type));
    engine.resolveLanding();
    expect(events.indexOf('goldChanged')).toBeLessThan(events.indexOf('bankrupt'));
    expect(engine.state.players[0].bankrupt).toBe(true);
    expect(engine.state.owners[1]).toBeNull();
  });

  it('announces the compass result before moving the fleet that many steps', () => {
    const engine = new GameEngine({ players: twoPlayers, rng: spinTwo });
    const events: unknown[] = [];
    engine.on((event) => events.push(event));
    expect(engine.spinCompass()).toBe(2);
    expect(engine.state.lastSpin).toBe(2);
    expect(engine.state.phase).toBe('spinning');
    expect(engine.currentPlayer.position).toBe(0);
    expect(events).toEqual([{ type: 'compassSpun', playerId: 0, steps: 2 }]);
    expect(() => engine.spinCompass()).toThrow();
    expect(() => engine.resolveLanding()).toThrow();
    const path = engine.sail();
    expect(path).toEqual([1, 2]);
    expect(engine.currentPlayer.position).toBe(2);
    expect(engine.state.phase).toBe('moving');
    expect(() => engine.sail()).toThrow();
  });

  it('offers and claims an unowned island', () => {
    const engine = new GameEngine({ players: twoPlayers, config: { startingGold: 1000 }, rng: spinTwo });
    spinAndSail(engine);
    engine.resolveLanding();
    expect(engine.state.phase).toBe('awaitingClaim');
    const price = engine.state.map[2].price!;
    engine.claim();
    expect(engine.state.owners[2]).toBe(0);
    expect(engine.state.players[0].gold).toBe(1000 - price);
    expect(engine.state.currentPlayer).toBe(1);
  });

  it('charges a toll on a rival colony', () => {
    const engine = new GameEngine({ players: twoPlayers, config: { startingGold: 1000 }, rng: spinTwo });
    spinAndSail(engine);
    engine.resolveLanding();
    engine.claim();
    engine.currentPlayer.position = 0;
    spinAndSail(engine);
    engine.resolveLanding();
    expect(engine.state.phase).toBe('awaitingToll');
    engine.payToll();
    const toll = engine.state.map[2].toll!;
    expect(engine.state.players[1].gold).toBe(1000 - toll);
    expect(engine.state.players[0].gold).toBe(1000 - engine.state.map[2].price! + toll);
  });

  it('pays the royal salary when reaching home', () => {
    const engine = new GameEngine({ players: [twoPlayers[0]], rng: spinTwelve });
    engine.currentPlayer.position = engine.state.map.length - 12;
    const before = engine.currentPlayer.gold;
    spinAndSail(engine);
    expect(engine.currentPlayer.position).toBe(0);
    expect(engine.currentPlayer.gold).toBe(before); // paid once the fleet has sailed in
    engine.resolveLanding();
    expect(engine.currentPlayer.gold).toBe(before + DEFAULT_CONFIG.homeSalary);
  });

  it('pays the salary for every lap on a short route', () => {
    const map = createDefaultMap().slice(0, 4);
    const engine = new GameEngine({ players: [twoPlayers[0]], rng: spinTwelve, map });
    const before = engine.currentPlayer.gold;
    spinAndSail(engine); // 12 steps on a 4-stop route: home three times
    engine.resolveLanding();
    expect(engine.currentPlayer.gold).toBe(before + 3 * engine.state.config.homeSalary);
  });

  it('logs the destination only once the fleet arrives', () => {
    const engine = new GameEngine({ players: twoPlayers, rng: spinTwo });
    spinAndSail(engine);
    const destination = engine.state.map[2].name;
    expect(engine.state.log.join(' ')).not.toContain(destination);
    engine.resolveLanding();
    engine.decline();
    expect(engine.state.log.join(' ')).toContain(destination);
  });

  it('logs the toll actually paid by a nearly broke fleet', () => {
    const engine = new GameEngine({ players: twoPlayers, rng: spinTwo });
    spinAndSail(engine);
    engine.resolveLanding();
    engine.claim();
    engine.state.players[1].gold = 10;
    engine.currentPlayer.position = 0;
    spinAndSail(engine);
    engine.resolveLanding();
    engine.payToll();
    expect(engine.state.log).toContain(`Rival pays 10g toll to You at ${engine.state.map[2].name}.`);
  });

  it('plays an all-AI game to completion', () => {
    const engine = new GameEngine({
      players: [0, 1, 2].map((i) => ({ name: `AI ${i}`, color: i, isAI: true })),
    });
    engine.start();
    let guard = 0;
    while (engine.state.phase !== 'gameOver' && guard++ < 10_000) {
      if (engine.state.phase === 'awaitingSpin') {
        engine.decideForAI();
        if (engine.state.phase === 'awaitingSpin') spinAndSail(engine);
      }
      else if (engine.state.phase === 'moving') engine.resolveLanding();
      else engine.decideForAI();
    }
    expect(engine.state.phase).toBe('gameOver');
    expect(engine.state.winner).not.toBeNull();
  });

  it('rotates the first navigator without skipping or repeating a navigator within a round', () => {
    const engine = new GameEngine({ players: [...twoPlayers, twoPlayers[1]], rng: spinTwo });
    const turns: number[][] = [];
    engine.on((event, { round }) => {
      if (event.type === 'turnStarted') (turns[round - 1] ??= []).push(event.playerId);
    });
    engine.start();
    for (let i = 0; i < 8; i++) {
      spinAndSail(engine);
      engine.resolveLanding();
      if (engine.state.phase === 'awaitingClaim') engine.decline();
    }
    expect(turns).toEqual([[0, 1, 2], [1, 2, 0], [2, 0, 1]]);
  });

  it('awards the round-limit win by cash plus discounted colony value', () => {
    const engine = new GameEngine({ players: twoPlayers, config: { maxRounds: 1 }, rng: spinTwo });
    engine.state.players[1].gold += 85;
    spinAndSail(engine);
    engine.resolveLanding();
    engine.claim();
    const price = engine.state.map[2].price!;
    expect(engine.netWorth(0)).toBe(DEFAULT_CONFIG.startingGold - price + Math.floor(price * 0.75));
    expect(engine.state.phase).toBe('awaitingSpin');
    spinAndSail(engine);
    engine.resolveLanding();
    if (engine.state.phase === 'awaitingClaim') engine.decline();
    expect(engine.state.winner).toBe(1);
  });
});
