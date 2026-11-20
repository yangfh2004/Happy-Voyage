import { describe, expect, it } from 'vitest';
import { GameEngine, SEA_RULES } from './engine';
import { createDefaultMap } from './map';
import type { EventKind, SeaEventResult } from './types';

function encounter(event: EventKind, rng = 0.5, setup: (g: GameEngine) => void = () => {}) {
  const g = new GameEngine({ players: [0, 1].map((id) => ({ name: String(id), color: id, isAI: true })), rng: () => rng });
  const p = g.currentPlayer;
  const results: SeaEventResult[] = [];
  g.on((e) => { if (e.type === 'seaEvent') results.push(e); });
  g.on((e) => {
    if (e.type === 'seaEvent') expect(g.state.log.at(-1)).toContain(p.name + ': ');
  });
  setup(g);
  p.position = g.state.map.find((n) => n.event === event)!.id;
  g.state.phase = 'moving';
  g.resolveLanding();
  return { g, p, results };
}

describe('sea event outcomes', () => {
  it('places every event kind on the map', () => {
    expect(new Set(createDefaultMap().flatMap((n) => n.event ? [n.event] : []))).toEqual(new Set([
      'treasure', 'storm', 'tradeWind', 'pirates', 'smallMonster', 'largeMonster', 'turtle', 'whirlpool', 'bottle', 'floatingCargo', 'merchant', 'wyvern',
    ]));
  });

  it.each([true, false])('fights pirates with victory=%s', (win) => {
    const { p, results } = encounter('pirates', 0.5, (g) => {
      for (const ship of g.currentPlayer.fleet) {
        ship.firepower = win ? 200 : 0;
        if (!win) ship.durability = 1;
      }
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ event: 'pirates', outcome: win ? 'victory' : 'defeat', gold: win ? SEA_RULES.pirateLoot : -SEA_RULES.pirates });
    expect(p.fleet.length).toBeGreaterThan(0);
    if (!win) expect(results[0].shipsLost).toHaveLength(2);
  });

  it('small monsters damage just one ship and charge a small loss', () => {
    const { p, results } = encounter('smallMonster');
    expect(p.fleet.filter((s) => s.durability < s.maxDurability)).toHaveLength(1);
    expect(results[0]).toMatchObject({ outcome: 'damaged', damage: SEA_RULES.smallMonsterDamage, gold: -SEA_RULES.smallMonster });
  });

  it.each([0.1, 0.9])('large monsters damage the fleet and may sink a ship (%s)', (rng) => {
    const { p, results } = encounter('largeMonster', rng);
    expect(p.fleet.every((s) => s.durability === s.maxDurability - SEA_RULES.largeMonsterDamage)).toBe(true);
    expect(results[0].shipsLost).toHaveLength(rng < SEA_RULES.monsterSinkChance ? 1 : 0);
    expect(results[0].gold).toBe(-SEA_RULES.largeMonster);
  });

  it.each(['largeMonster', 'turtle'] as const)('%s never sinks the last ship', (event) => {
    const { p, results } = encounter(event, 0, (g) => { g.currentPlayer.fleet.splice(1); });
    expect(p.fleet).toHaveLength(1);
    expect(p.fleet[0].durability).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({ outcome: 'damaged', shipsLost: [] });
  });

  it('a turtle destroys one non-last ship', () => {
    const { p, results } = encounter('turtle');
    expect(p.fleet).toHaveLength(2);
    expect(results[0]).toMatchObject({ outcome: 'sunk', shipsLost: [2] });
  });

  it.each([[0.05, 'specialPrize'], [0.2, 'repaired'], [0.8, 'gold']] as const)('bottle roll %s grants %s', (rng, outcome) => {
    const { p, results } = encounter('bottle', rng, (g) => { g.currentPlayer.fleet[0].durability = 1; });
    expect(results[0].outcome).toBe(outcome);
    if (outcome === 'repaired') expect(p.fleet.every((s) => s.durability === s.maxDurability)).toBe(true);
    else expect(results[0].gold).toBe(outcome === 'specialPrize' ? SEA_RULES.bottlePrize : SEA_RULES.bottle);
  });

  it.each([false, true])('cargo loads specialties or gives gold if full=%s', (full) => {
    const { p, results } = encounter('floatingCargo', 0.9, (g) => {
      if (full) for (const ship of g.currentPlayer.fleet) ship.cargo.iron = ship.cargoCapacity;
    });
    expect(results[0].outcome).toBe(full ? 'gold' : 'cargo');
    if (!full) expect(p.fleet[0].cargo[results[0].good!]).toBe(SEA_RULES.cargoUnits);
  });

  it('cargo can randomly grant gold despite free hold', () => {
    expect(encounter('floatingCargo', 0).results[0]).toMatchObject({ outcome: 'gold', gold: SEA_RULES.floatingCargo });
  });

  it.each(['accept', 'decline', 'ai'] as const)('merchant waits for %s', (choice) => {
    const { g, p, results } = encounter('merchant', 0, (g) => { g.currentPlayer.fleet[0].cargo.Silk = 3; });
    expect(results).toHaveLength(0);
    expect(g.state.phase).toBe('awaitingMerchant');
    const gold = p.gold;
    if (choice === 'decline') g.declineMerchant();
    else if (choice === 'ai') g.decideForAI();
    else g.acceptMerchant();
    expect(results).toHaveLength(1);
    expect(results[0].outcome).toBe(choice === 'decline' ? 'declined' : 'accepted');
    expect(p.gold).toBe(choice === 'decline' ? gold : gold + 405);
    expect(p.fleet[0].cargo.Silk).toBe(choice === 'decline' ? 3 : undefined);
    expect(g.state.pendingMerchant).toBeNull();
    expect(() => g.acceptMerchant()).toThrow();
  });

  it('merchant does not pay for absent cargo and rejects missing promised cargo', () => {
    expect(encounter('merchant').results[0].outcome).toBe('noTrade');
    const { g, p, results } = encounter('merchant', 0, (g) => { g.currentPlayer.fleet[0].cargo.Tea = 1; });
    p.fleet[0].cargo = {};
    expect(() => g.acceptMerchant()).toThrow('Not enough cargo');
    expect(results).toHaveLength(0);
    expect(g.state.phase).toBe('awaitingMerchant');
  });

  it('wyvern validates a chosen destination and resolves its landing', () => {
    const { g, p, results } = encounter('wyvern');
    expect(g.state.phase).toBe('awaitingWyvern');
    expect(() => g.wyvernFly(-1)).toThrow('Unknown destination');
    expect(() => g.wyvernFly(1.2)).toThrow('Unknown destination');
    expect(results).toHaveLength(0);
    const target = g.state.map.find((n) => n.event === 'treasure')!.id;
    g.wyvernFly(target);
    expect(p.position).toBe(target);
    expect(g.state.phase).toBe('moving');
    g.resolveLanding();
    expect(results.map((e) => e.outcome)).toEqual(['relocated', 'gold']);
    expect(() => g.wyvernFly(0)).toThrow();
  });

  it('AI chooses an affordable neutral colony for wyvern travel', () => {
    const { g, p } = encounter('wyvern');
    g.decideForAI();
    expect(g.state.map[p.position].kind).toBe('island');
    g.resolveLanding();
    expect(g.state.phase).toBe('awaitingClaim');
  });

  it.each([0, 0.9])('whirlpool preserves damage or relocation (%s)', (rng) => {
    const { g, results } = encounter('whirlpool', rng);
    expect(results).toHaveLength(1);
    expect(results[0].outcome).toBe(rng === 0 ? 'damaged' : 'relocated');
    expect(g.state.phase).toBe(rng === 0 ? 'awaitingSpin' : 'moving');
  });

  it.each(['storm', 'pirates', 'smallMonster', 'largeMonster', 'turtle', 'whirlpool'] as const)('revival emits one protected %s outcome', (event) => {
    const { results, p } = encounter(event, 0, (g) => { g.currentPlayer.revivalProtection = true; });
    expect(results).toEqual([{ type: 'seaEvent', playerId: 0, event, outcome: 'protected' }]);
    expect(p.revivalProtection).toBe(false);
  });

  it.each(['pirates', 'smallMonster', 'largeMonster', 'turtle', 'bottle', 'floatingCargo'] as const)('handles an empty fleet at %s', (event) => {
    const { results } = encounter(event, 0, (g) => { g.currentPlayer.fleet = []; });
    expect(results).toHaveLength(1);
  });
});
