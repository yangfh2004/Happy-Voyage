import { describe, expect, it } from 'vitest';
import { GameEngine, EVENT_GOLD } from './engine';
import { STRATEGIES, STRATEGY_RULES } from './strategies';

const players = [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }];
function game() { return new GameEngine({ players, rng: () => 0, config: { startingStrategies: 0 } }); }
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
    expect(g.canUseStrategy('inspire')).toBe(false);
    expect(g.currentPlayer.strategies).toHaveLength(5);
  });
  it('navigates directly into normal claim and toll resolution without salary', () => {
    const g = game();
    g.currentPlayer.strategies = ['navigate'];
    const island = g.state.map.find((n) => n.kind === 'island')!;
    const gold = g.currentPlayer.gold;
    g.useStrategy('navigate', island.id);
    expect(g.state.phase).toBe('awaitingClaim');
    expect(g.currentPlayer.gold).toBe(gold);
    expect(g.currentPlayer.strategies).toEqual([]);
    expect(g.state.strategyUsed).toBe(true);
    g.decline();
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
    expect(g.state.players[0].gold - gold).toBe(STRATEGY_RULES.hoardGold + EVENT_GOLD.treasure.min);
    expect(g.state.players.every((p) => p.knownHoard === null)).toBe(true);
    expect(g.state.hoardNode).not.toBe(node);
  });
  it.each(['mislead', 'betray'] as const)('%s removes one defender and protects the last fleet ship', (id) => {
    const g = game();
    const node = rival(g);
    g.currentPlayer.strategies = [id];
    const fleet = g.state.players[1].fleet;
    const ship = fleet[0];
    g.useStrategy(id);
    expect(fleet).toHaveLength(2);
    expect(g.currentPlayer.fleet.includes(ship)).toBe(id === 'betray');
    expect(g.state.phase).toBe('awaitingToll');
    g.state.strategyUsed = false;
    g.currentPlayer.strategies = [id];
    fleet.splice(1);
    expect(g.canUseStrategy(id)).toBe(false);
    g.state.docks[node] = [g.addShipToFleet(1, 'cargo')];
    fleet.pop();
    expect(g.canUseStrategy(id)).toBe(true);
    g.useStrategy(id);
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
    p.position = g.state.map.find((n) => n.event === 'bottle')!.id;
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
    expect(other.state.phase).toBe('awaitingClaim');
    expect(other.currentPlayer.strategies).toEqual([]);
  });
  it('grants bottle cards while preserving the gold reward', () => {
    const g = game();
    const p = g.currentPlayer;
    p.position = g.state.map.find((n) => n.event === 'bottle')!.id;
    g.state.phase = 'moving';
    const gold = p.gold;
    g.resolveLanding();
    expect(p.strategies).toHaveLength(1);
    expect(p.gold).toBeGreaterThan(gold);
  });
  it('grants a card and gold on a hermit Nim win, but none on a loss', () => {
    for (const roll of [0, 0.999]) {
      const g = new GameEngine({ players, rng: () => roll, config: { startingStrategies: 0 } });
      const p = g.currentPlayer;
      const gold = p.gold;
      p.position = g.state.map.find((n) => n.special === 'mist')!.id;
      g.state.phase = 'moving';
      g.resolveLanding();
      expect(p.strategies).toHaveLength(roll ? 1 : 0);
      expect(p.gold - gold).toBe(roll ? 130 : 0);
    }
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
