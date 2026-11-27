import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { STRATEGIES, STRATEGY_RULES } from './strategies';
import type { MapNode } from './types';

const players = [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }];
function game() { return new GameEngine({ players, rng: () => 0, config: { startingStrategies: 0, battleMode: 'auto' } }); }
function rival(g: GameEngine) {
  const id = g.state.map.find((n) => n.kind === 'island')!.id;
  g.currentPlayer.position = id;
  g.state.owners[id] = 1;
  g.state.phase = 'awaitingToll';
  return id;
}

describe('strategy cards', () => {
  it('deals three distinct cards and caps configurable starting hands', () => {
    for (const startingStrategies of [3, 20]) {
      const g = new GameEngine({ players, rng: () => 0, config: { startingStrategies } });
      for (const p of g.state.players) expect(new Set(p.strategies).size).toBe(Math.min(startingStrategies, 5));
    }
  });
  it('allows duplicates, emits acquisition and discards overflow', () => {
    const g = game();
    const events: string[] = [];
    g.on((e) => events.push(e.type));
    for (let i = 0; i < 5; i++) expect(g.gainStrategy(0, 'test', 'locate')).toBe(true);
    expect(g.gainStrategy(0, 'test')).toBe(false);
    expect(events.filter((e) => e === 'strategyGained')).toHaveLength(5);
    expect(g.state.log.at(-1)).toContain('discarded');
  });
  it('rejects missing, wrong-phase and invalid target cards without consuming them', () => {
    const g = game();
    expect(() => g.useStrategy('navigate', 0)).toThrow();
    g.currentPlayer.strategies = Object.keys(STRATEGIES) as (keyof typeof STRATEGIES)[];
    expect(g.canUseStrategy('navigate', -1)).toBe(false);
    expect(g.canUseStrategy('navigate')).toBe(false);
    expect(g.canUseStrategy('inspire')).toBe(true);
    expect(g.currentPlayer.strategies).toHaveLength(20);
  });
  it('navigates directly into normal claim and toll resolution without salary', () => {
    const g = game();
    g.currentPlayer.revivalProtection = true;
    g.currentPlayer.strategies = ['navigate'];
    const island = g.state.map.find((n) => n.kind === 'island')!;
    const gold = g.currentPlayer.gold;
    g.useStrategy('navigate', island.id);
    expect(g.state.phase).toBe('awaitingBuild');
    expect(g.state.players[0].gold).toBe(gold);
    expect(g.state.players[0].strategies).toEqual([]);
    expect(g.state.owners[island.id]).toBe(0);
    g.finishBuilding();
    expect(g.state.strategyUsed).toBe(false);
    g.currentPlayer.strategies = ['navigate'];
    g.state.owners[island.id] = 0;
    g.useStrategy('navigate', island.id);
    expect(g.state.phase).toBe('awaitingToll');
  });
  it('locates and awards a hoard on top of treasure, reburying elsewhere and clearing knowledge', () => {
    const g = game();
    g.currentPlayer.strategies = ['locate', 'navigate'];
    g.useStrategy('locate');
    const node = g.currentPlayer.knownHoard!;
    expect(node).toBe(g.state.hoardNode);
    expect(g.canUseStrategy('navigate', node)).toBe(false);
    g.state.players[1].knownHoard = node;
    const gold = g.currentPlayer.gold;
    g.currentPlayer.position = node;
    g.state.phase = 'moving';
    g.resolveLanding();
    expect(g.state.players[0].gold - gold).toBe(STRATEGY_RULES.hoardGold);
    expect(g.state.phase).toBe('awaitingSalvage');
    expect(g.state.players.every((p) => p.knownHoard === null)).toBe(true);
    expect(g.state.hoardNode).not.toBe(node);
  });
  it('mislead damages the lead defender without sinking and works on a single ship', () => {
    const g = game();
    const node = rival(g);
    g.currentPlayer.strategies = ['mislead'];
    const fleet = g.state.players[1].fleet;
    const lead = fleet[0];
    const before = lead.durability;
    g.useStrategy('mislead');
    expect(fleet).toHaveLength(8);
    expect(lead.durability).toBe(before - STRATEGY_RULES.misleadDamage);
    expect(g.state.phase).toBe('awaitingToll');
    g.state.strategyUsed = false;
    g.currentPlayer.strategies = ['mislead'];
    fleet.splice(1);
    fleet[0].durability = 10;
    expect(g.canUseStrategy('mislead')).toBe(true);
    g.useStrategy('mislead');
    expect(fleet[0].durability).toBe(1);
    g.state.docks[node] = [g.addShipToFleet(1, 'cargo')];
    fleet.pop();
    g.state.strategyUsed = false;
    g.currentPlayer.strategies = ['mislead'];
    expect(g.canUseStrategy('mislead')).toBe(true);
    g.useStrategy('mislead');
    expect(g.state.docks[node][0].durability).toBe(g.state.docks[node][0].maxDurability - STRATEGY_RULES.misleadDamage);
  });
  it('betray recruits the weakest defender and protects the last fleet ship', () => {
    const g = game();
    const node = rival(g);
    g.currentPlayer.strategies = ['betray'];
    const fleet = g.state.players[1].fleet;
    const weakest = [...fleet].sort((a, b) => a.firepower - b.firepower)[0];
    g.useStrategy('betray');
    expect(fleet).toHaveLength(7);
    expect(g.currentPlayer.fleet.includes(weakest)).toBe(true);
    expect(g.state.phase).toBe('awaitingToll');
    g.state.strategyUsed = false;
    g.currentPlayer.strategies = ['betray'];
    fleet.splice(1);
    expect(g.canUseStrategy('betray')).toBe(false);
    g.state.docks[node] = [g.addShipToFleet(1, 'cargo')];
    fleet.pop();
    expect(g.canUseStrategy('betray')).toBe(true);
    g.useStrategy('betray');
    expect(g.state.docks[node]).toHaveLength(0);
  });
  it('inspires the next battle without modifying ship firepower', () => {
    const g = game();
    rival(g);
    g.currentPlayer.strategies = ['inspire'];
    const ships = [...g.currentPlayer.fleet];
    const power = ships.map((s) => s.firepower);
    g.useStrategy('inspire');
    expect(g.state.inspired).toBe(true);
    expect(g.state.phase).toBe('awaitingToll');
    g.fight();
    if (g.state.phase === 'awaitingBuild') g.finishBuilding();
    expect(g.state.inspired).toBe(false);
    expect(ships.map((s) => s.firepower)).toEqual(power);
  });
  it('applies the Inspire multiplier to volleys and clears it when paying instead', () => {
    const damage = (inspire: boolean) => {
      const g = game();
      rival(g);
      for (const p of g.state.players) {
        p.fleet.splice(1);
        p.fleet[0].durability = 1000;
        p.fleet[0].firepower = 10;
      }
      g.currentPlayer.strategies = ['inspire'];
      if (inspire) g.useStrategy('inspire');
      g.fight();
      return 1000 - g.state.players[1].fleet[0].durability;
    };
    expect(damage(true)).toBeGreaterThan(damage(false));
    const g = game();
    rival(g);
    g.currentPlayer.strategies = ['inspire'];
    g.useStrategy('inspire');
    g.payToll();
    expect(g.state.inspired).toBe(false);
  });
  it('handles maps without treasure and bottles without a card reward', () => {
    const g = new GameEngine({ players, rng: () => 0.999, config: { startingStrategies: 0 } });
    const p = g.currentPlayer;
    const bottle = g.state.map.find((n) => n.event === 'openSea')!;
    bottle.event = 'bottle';
    p.position = bottle.id;
    g.state.phase = 'moving';
    g.resolveLanding();
    expect(p.strategies).toHaveLength(0);
    const empty = new GameEngine({ players, map: [{ id: 0, name: 'Home', kind: 'port', x: 0, y: 0 }] });
    empty.currentPlayer.strategies = ['locate'];
    expect(empty.state.hoardNode).toBeNull();
    expect(empty.canUseStrategy('locate')).toBe(false);
  });
  it('AI locates unknown treasure and navigates to neutral claimable land', () => {
    const g = game();
    g.currentPlayer.strategies = ['locate'];
    g.decideForAI();
    expect(g.currentPlayer.knownHoard).toBe(g.state.hoardNode);
    const other = game();
    other.currentPlayer.strategies = ['navigate'];
    other.decideForAI();
    expect(other.state.phase).toBe('awaitingBuild');
    expect(other.state.players[0].strategies).toEqual([]);
  });
  it('AI uses Navigate for free occupation despite nearby hazards and low gold', () => {
    const map: MapNode[] = Array.from({ length: 40 }, (_, id) => ({
      id, name: `Stop ${id}`, x: id, y: 0,
      kind: id === 0 ? 'port' : id === 20 || id === 21 ? 'island' : 'event',
      event: id >= 22 && id <= 33 ? 'pirates' : 'tradeWind',
      price: 100,
    }));
    const g = new GameEngine({ players: [players[1]], map, rng: () => 0.99, config: { startingStrategies: 0, maxRounds: 2, islandsToWin: 2 } });
    const player = g.currentPlayer;
    player.gold = 0;
    player.strategies = ['navigate'];
    g.decideForAI();
    expect(player.position).toBe(20);
    expect(g.state.owners[20]).toBe(player.id);
    expect(player.gold).toBe(0);
    expect(player.strategies).toEqual([]);
    expect(g.state.phase).toBe('awaitingBuild');
  });
  it.each(['mislead', 'betray'] as const)('AI forecasts the fallback fleet before using %s on the last docked ship', (card) => {
    const g = game();
    const node = rival(g);
    const attacker = g.currentPlayer;
    const owner = g.state.players[1];
    attacker.fleet.splice(1);
    attacker.fleet[0].durability = 100;
    attacker.fleet[0].firepower = 10;
    owner.fleet.splice(1);
    owner.fleet[0].durability = 10000;
    owner.fleet[0].firepower = 10000;
    const docked = g.addShipToFleet(1, 'cargo');
    owner.fleet.pop();
    docked.durability = 1000;
    docked.firepower = 1;
    g.state.docks[node] = [docked];
    attacker.strategies = [card];
    g.decideForAI();
    expect(attacker.strategies).toEqual([card]);
    expect(g.state.docks[node]).toEqual([docked]);
    expect(g.state.battles).toHaveLength(0);
  });
  it('grants bottle cards while preserving the gold reward', () => {
    const g = game();
    const p = g.currentPlayer;
    const bottle = g.state.map.find((n) => n.event === 'openSea')!;
    bottle.event = 'bottle';
    p.position = bottle.id;
    g.state.phase = 'moving';
    const gold = p.gold;
    g.resolveLanding();
    expect(p.strategies).toHaveLength(1);
    expect(p.gold).toBeGreaterThan(gold);
  });
  it('AI navigates to its known hoard and uses battle cards before fighting', () => {
    const g = game();
    const p = g.currentPlayer;
    p.strategies = ['navigate'];
    p.knownHoard = g.state.hoardNode;
    g.decideForAI();
    expect(p.strategies).toHaveLength(0);
    expect(p.position).toBe(p.knownHoard ?? g.state.map.find((n) => n.event === 'treasure')!.id);
    g.state.currentPlayer = 0;
    g.state.strategyUsed = false;
    rival(g);
    g.currentPlayer.gold = 0;
    g.currentPlayer.strategies = ['betray'];
    const player = g.currentPlayer;
    g.decideForAI();
    expect(player.strategies).toHaveLength(0);
  });
});
