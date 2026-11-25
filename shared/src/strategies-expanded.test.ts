import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { STRATEGIES, STRATEGY_RULES, strategyTarget, type StrategyId } from './strategies';
import { fightNavalBattle, forecastColonyBattle, tollDue } from './combat';
import { colonyProduction } from './buildings';
import { walkPath } from './graph';
import { aiSeaStrategy } from './ai';

function setup(card: StrategyId) {
  const g = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }], rng: () => 0, config: { startingStrategies: 0, islandsToWin: 99, battleMode: 'auto' } });
  g.currentPlayer.strategies = [card];
  const node = g.state.map.find((n) => n.kind === 'island')!.id;
  g.state.owners[node] = 1;
  return { g, p: g.currentPlayer, rival: g.state.players[1], node };
}

function eventStop(g: GameEngine, event: 'whirlpool' | 'pirates') {
  const node = g.state.map.find((n) => n.event === 'openSea')!;
  node.event = event;
  return node.id;
}

describe('expanded strategy legality', () => {
  it.each(Object.keys(STRATEGIES) as StrategyId[])('%s declares and enforces phases and targets', (id) => {
    const { g, p, rival, node } = setup(id);
    for (const phase of ['awaitingSpin', 'awaitingToll', 'awaitingBuild', 'moving'] as const) {
      g.state.phase = phase;
      p.position = node;
      const kind = strategyTarget(id, phase);
      const target = kind === 'node' || kind === 'rivalColony' ? node : kind === 'rival' ? rival.id : undefined;
      expect(g.canUseStrategy(id, target)).toBe(STRATEGIES[id].phases.includes(phase));
      if (kind !== 'none') {
        expect(g.canUseStrategy(id)).toBe(false);
        expect(g.canUseStrategy(id, -1)).toBe(false);
        expect(g.canUseStrategy(id, 1.5)).toBe(false);
      } else expect(g.canUseStrategy(id, node)).toBe(false);
      g.state.strategyUsed = true;
      expect(g.canUseStrategy(id, target)).toBe(false);
      g.state.strategyUsed = false;
    }
    g.state.phase = STRATEGIES[id].phases[0];
    p.strategies = [];
    expect(g.canUseStrategy(id, node)).toBe(false);
    expect(() => g.useStrategy(id, node)).toThrow('Cannot use strategy');
  });
  it.each(['blockade', 'plunder', 'gale', 'exchange', 'mislead', 'betray'] as const)('%s rejects yourself and bankrupt rivals', (id) => {
    const { g, rival } = setup(id);
    expect(g.canUseStrategy(id, 0)).toBe(false);
    rival.bankrupt = true;
    expect(g.canUseStrategy(id, 1)).toBe(false);
  });
  it.each(['revolt', 'scorch'] as const)('%s requires a live rival colony', (id) => {
    const { g, node } = setup(id);
    for (const owner of [null, 0]) {
      g.state.owners[node] = owner;
      expect(g.canUseStrategy(id, node)).toBe(false);
    }
    g.state.owners[node] = 1;
    g.state.players[1].bankrupt = true;
    expect(g.canUseStrategy(id, node)).toBe(false);
  });
});

describe('sea strategy effects', () => {
  it.each(['tailwind', 'reverse'] as const)('%s changes the compass and actual walk', (id) => {
    const { g, p } = setup(id);
    const from = p.position;
    g.useStrategy(id);
    const steps = id === 'tailwind' ? 4 : -2;
    expect(g.spinCompass()).toBe(steps);
    expect(g.sail()).toEqual(walkPath(g.state.map, from, steps, g.state.wind.direction));
  });
  it('blockade skips exactly one turn and logs it', () => {
    const { g, rival, node } = setup('blockade');
    g.useStrategy('blockade', 1);
    g.state.phase = 'awaitingClaim';
    g.state.pendingClaim = node;
    g.decline();
    expect(g.currentPlayer.id).toBe(0);
    expect(rival.skipNextTurn).toBe(false);
    expect(g.state.log.some((s) => s.includes('skips a turn'))).toBe(true);
    g.state.phase = 'awaitingClaim';
    g.state.pendingClaim = node;
    g.decline();
    expect(g.currentPlayer.id).toBe(1);
  });
  it.each([false, true])('continues after every survivor skips a new round (first seat eliminated: %s)', (eliminated) => {
    const g = new GameEngine({ players: [0, 1, 2].map((id) => ({ name: `Player ${id}`, color: id, isAI: false })), config: { islandsToWin: 99, maxRounds: 999 } });
    g.state.players[0].bankrupt = eliminated;
    for (const player of g.state.players) if (!player.bankrupt) player.skipNextTurn = true;
    g.state.currentPlayer = 2;
    g.state.phase = 'awaitingClaim';
    g.state.pendingClaim = g.state.map.find((n) => n.kind === 'island')!.id;
    expect(() => g.decline()).not.toThrow();
    expect(g.state.round).toBe(3);
    expect(g.currentPlayer.id).toBe(eliminated ? 1 : 0);
    expect(g.state.phase).toBe('awaitingSpin');
    expect(g.state.players.every((p) => !p.skipNextTurn)).toBe(true);
  });
  it.each([0, 1000, 10000])('plunder takes capped 10%% from %s gold', (gold) => {
    const { g, p, rival } = setup('plunder');
    rival.gold = gold;
    const before = p.gold;
    const amount = Math.min(STRATEGY_RULES.plunderCap, Math.floor(gold * STRATEGY_RULES.plunderRate));
    g.useStrategy('plunder', 1);
    expect(rival.gold).toBe(gold - amount);
    expect(p.gold).toBe(before + amount);
  });
  it('gale damages each ship without sinking', () => {
    const { g, rival } = setup('gale');
    rival.fleet[0].durability = 5;
    const before = rival.fleet.map((s) => s.durability);
    g.useStrategy('gale', 1);
    expect(rival.fleet.map((s) => s.durability)).toEqual(before.map((n) => Math.max(1, n - STRATEGY_RULES.galeDamage)));
  });
  it.each(['storm', 'whirlpool'] as const)('gale does not repair ships left at zero durability by %s', (event) => {
    const { g, p, rival } = setup('gale');
    const ship = rival.fleet[0];
    ship.durability = 5;
    g.state.currentPlayer = rival.id;
    rival.position = event === 'storm' ? g.state.map.find((n) => n.event === 'storm')!.id : eventStop(g, event);
    g.state.phase = 'moving';
    g.resolveLanding();
    expect(rival.fleet).toContain(ship);
    expect(ship.durability).toBe(0);
    const before = rival.fleet.map((s) => s.durability);
    g.state.currentPlayer = p.id;
    g.state.phase = 'awaitingSpin';
    g.useStrategy('gale', rival.id);
    expect(rival.fleet.map((s) => s.durability)).toEqual(before.map((n) => Math.min(n, Math.max(1, n - STRATEGY_RULES.galeDamage))));
    expect(ship.durability).toBe(0);
  });
  it('mislead damages a random rival fleet ship without sinking', () => {
    const { g, rival } = setup('mislead');
    const first = rival.fleet[0];
    const before = first.durability;
    const count = rival.fleet.length;
    g.useStrategy('mislead', 1);
    expect(rival.fleet).toHaveLength(count);
    expect(first.durability).toBe(before - STRATEGY_RULES.misleadDamage);
    rival.fleet.splice(1);
    rival.fleet[0].durability = 10;
    g.state.strategyUsed = false;
    g.currentPlayer.strategies = ['mislead'];
    expect(g.canUseStrategy('mislead', 1)).toBe(true);
    g.useStrategy('mislead', 1);
    expect(rival.fleet[0].durability).toBe(1);
    g.state.strategyUsed = false;
    g.currentPlayer.strategies = ['mislead'];
    expect(g.canUseStrategy('mislead', 1)).toBe(false);
    const node = g.state.map.find((n) => n.kind === 'island')!.id;
    g.state.owners[node] = 1;
    g.currentPlayer.position = node;
    g.state.phase = 'awaitingToll';
    expect(g.canUseStrategy('mislead')).toBe(false);
  });
  it.each([1, 2, 3, 4, 7, 10, 15])('betray recruits the weakest single ship of %s ships with survivor', (count) => {
    const { g, p, rival } = setup('betray');
    rival.fleet = [];
    const initial = p.fleet.length;
    const cargo = g.addShipToFleet(1, 'cargo');
    cargo.firepower = 0;
    for (let i = 1; i < count; i++) rival.fleet.push({ ...cargo, id: g.state.nextShipId++, firepower: i, cargo: {} });
    const weakest = rival.fleet[0];
    if (count === 1) { expect(g.canUseStrategy('betray', 1)).toBe(false); return; }
    g.useStrategy('betray', 1);
    expect(p.fleet.slice(initial)).toEqual([weakest]);
    expect(rival.fleet.length).toBe(count - 1);
  });
  it('escort survives turns and harmless events, then blocks one harmful event independently of revival', () => {
    const { g, p } = setup('escort');
    g.useStrategy('escort');
    p.position = g.state.map.find((n) => n.event === 'tradeWind')!.id;
    g.state.phase = 'moving';
    g.resolveLanding();
    expect(p.escortProtection).toBe(true);
    const gold = p.gold;
    g.state.currentPlayer = p.id;
    p.fleet[0].durability = 1;
    const repairFee = p.fleet.reduce((sum, ship) => sum + ship.maxDurability - ship.durability, 0) * 2;
    p.position = g.state.map.find((n) => n.special === 'revival')!.id;
    g.state.phase = 'moving';
    g.resolveLanding();
    expect(p.fleet[0].durability).toBe(p.fleet[0].maxDurability);
    expect(p.gold).toBe(gold - repairFee);
    expect(p.escortProtection).toBe(true);
    expect(p.revivalProtection).toBe(false);
    g.leaveRevivalIsland();
    const hazard = g.state.map.find((n) => n.event === 'storm')!.id;
    g.state.currentPlayer = 0;
    p.position = hazard;
    g.state.phase = 'moving';
    g.resolveLanding();
    expect(p.escortProtection).toBe(false);
    expect(p.revivalProtection).toBe(false);
    expect(p.gold).toBe(gold - repairFee);
    g.state.currentPlayer = 0;
    g.state.phase = 'moving';
    g.resolveLanding();
    expect(p.gold).toBeLessThan(gold);
  });
  it('revolt rejects docked ships and developed colonies, then clears ownership and goods', () => {
    const { g, rival, node } = setup('revolt');
    g.state.docks[node] = [rival.fleet.pop()!];
    expect(g.canUseStrategy('revolt', node)).toBe(false);
    g.state.docks[node] = [];
    g.state.buildings[node] = { lumberMill: 1 };
    expect(g.canUseStrategy('revolt', node)).toBe(false);
    g.state.buildings[node] = {};
    g.state.stockpiles[node] = { lumber: 10, iron: 20, specialties: { Spices: 5 } };
    g.useStrategy('revolt', node);
    expect(g.state.owners[node]).toBeNull();
    expect(g.state.buildings[node]).toEqual({});
    expect(g.state.stockpiles[node]).toEqual({ lumber: 0, iron: 0, specialties: {} });
  });
  it('harvest produces only for your colonies', () => {
    const { g, node } = setup('harvest');
    const own = g.state.map.find((n) => n.kind === 'island' && n.id !== node)!.id;
    g.state.owners[own] = 0;
    g.state.buildings[own] = { lumberMill: 1, ironMine: 1, collectionField: 1 };
    const expected = colonyProduction(g.state, own);
    g.useStrategy('harvest');
    expect(g.state.stockpiles[own].lumber).toBe(expected.lumber);
    expect(g.state.stockpiles[own].iron).toBe(expected.iron);
    expect(Object.values(g.state.stockpiles[own].specialties).reduce((a, b) => a + (b ?? 0), 0)).toBe(expected.specialty);
    expect(g.state.stockpiles[node]).toEqual({ lumber: 0, iron: 0, specialties: {} });
  });
  it.each([0, 3, 12])('charter pays for %s colonies with a 300g cap', (count) => {
    const { g, p } = setup('charter');
    g.state.map.filter((n) => n.kind === 'island').slice(0, count).forEach((n) => { g.state.owners[n.id] = 0; });
    const gold = p.gold;
    g.useStrategy('charter');
    expect(p.gold - gold).toBe(Math.min(STRATEGY_RULES.charterCap, STRATEGY_RULES.charterPerColony * count));
  });
  it('repair restores up to 30 durability per ship, including an empty fleet', () => {
    const { g, p } = setup('repair');
    p.fleet.forEach((s) => { s.durability = 1; });
    p.fleet[0].durability = p.fleet[0].maxDurability - 10;
    g.useStrategy('repair');
    expect(p.fleet[0].durability).toBe(p.fleet[0].maxDurability);
    expect(p.fleet.slice(1).every((s) => s.durability === 1 + STRATEGY_RULES.repairAmount)).toBe(true);
    p.fleet = [];
    p.strategies = ['repair'];
    g.state.strategyUsed = false;
    expect(() => g.useStrategy('repair')).not.toThrow();
  });
  it('recall resolves a home audience without salary', () => {
    const { g, p, node } = setup('recall');
    p.position = node;
    const gold = p.gold;
    g.useStrategy('recall');
    expect(p.position).toBe(p.homePort);
    expect(g.state.royalAudience?.playerId).toBe(p.id);
    expect(p.gold - gold).toBe(g.state.royalAudience!.reward);
  });
  it('exchange swaps positions but keeps the spin phase', () => {
    const { g, p, rival } = setup('exchange');
    const positions = [p.position, rival.position];
    g.useStrategy('exchange', 1);
    expect([rival.position, p.position]).toEqual(positions);
    expect(g.state.phase).toBe('awaitingSpin');
    expect(g.state.strategyUsed).toBe(true);
  });
  it('scorch destroys half of stored goods (rounded up) without touching buildings, ships or ownership', () => {
    const { g, node, rival } = setup('scorch');
    g.state.buildings[node] = { ironMine: 1 };
    g.state.docks[node] = [rival.fleet.pop()!];
    g.state.stockpiles[node] = { lumber: 10, iron: 20, specialties: { Spices: 5, Silk: 1 } };
    g.useStrategy('scorch', node);
    expect(g.state.stockpiles[node]).toEqual({ lumber: 5, iron: 10, specialties: { Spices: 2 } });
    expect(g.state.buildings[node]).toEqual({ ironMine: 1 });
    expect(g.state.docks[node]).toHaveLength(1);
    expect(g.state.owners[node]).toBe(1);
  });
});

describe('battle strategies', () => {
  it('exemption ends the turn with a zero toll, without transferring gold', () => {
    const { g, p, rival, node } = setup('exemption');
    p.position = node;
    g.state.phase = 'awaitingToll';
    const gold = [p.gold, rival.gold];
    const tolls: number[] = [];
    g.on((e) => { if (e.type === 'tollPaid') tolls.push(e.amount); });
    g.useStrategy('exemption');
    expect([p.gold, rival.gold]).toEqual(gold);
    expect(tolls).toEqual([0]);
    expect(g.currentPlayer.id).toBe(1);
  });
  it('ambush halves the first defensive volley only', () => {
    const { g, p, rival, node } = setup('ambush');
    p.position = node;
    g.state.phase = 'awaitingToll';
    g.useStrategy('ambush');
    p.fleet.splice(3);
    rival.fleet.splice(3);
    for (const ship of [...p.fleet, ...rival.fleet]) { ship.durability = 10000; ship.firepower = 10; }
    const baseline = p.fleet.map((s) => ({ ...s }));
    fightNavalBattle(baseline, rival.fleet.map((s) => ({ ...s })), () => 0);
    const before = p.fleet.reduce((sum, s) => sum + s.durability, 0);
    g.fight();
    expect(before - p.fleet.reduce((sum, s) => sum + s.durability, 0)).toBe(60);
    expect(before - baseline.reduce((sum, s) => sum + s.durability, 0)).toBe(72);
    expect(g.state.ambush).toBe(false);
  });
  it('inspire boosts pirate firepower damage without mutating ship stats', () => {
    const damage = (inspired: boolean) => {
      const { g, p } = setup('inspire');
      p.fleet.splice(3);
      for (const s of p.fleet) { s.firepower = 12; s.durability = 10000; }
      if (inspired) g.useStrategy('inspire');
      const events: number[] = [];
      g.on((e) => { if (e.type === 'seaEvent') events.push(e.gold ?? 0); });
      p.position = eventStop(g, 'pirates');
      g.state.phase = 'moving';
      g.resolveLanding();
      expect(p.fleet.every((s) => s.firepower === 12)).toBe(true);
      return events[0];
    };
    expect(damage(true)).toBeGreaterThan(damage(false));
  });
});

describe('AI strategy safety', () => {
  it.each(['easy', 'normal', 'hard'] as const)('%s exempts an unaffordable losing or drawn battle, but still fights a winning one', (difficulty) => {
    for (const outcome of ['defeat', 'draw', 'victory'] as const) {
      const { g, p, rival, node } = setup('exemption');
      p.aiDifficulty = difficulty;
      p.position = node;
      p.gold = 0;
      g.state.phase = 'awaitingToll';
      for (const ship of p.fleet) { ship.firepower = outcome === 'victory' ? 1000 : 0; ship.durability = 10000; }
      for (const ship of rival.fleet) { ship.firepower = outcome === 'defeat' ? 100000 : 0; ship.durability = outcome === 'draw' ? 10000 : 1; }
      expect(tollDue(g.state, p, node)).toBeGreaterThan(p.gold);
      expect(forecastColonyBattle(g.state, p)).toBe(outcome);
      g.decideForAI();
      expect(p.strategies.includes('exemption')).toBe(outcome === 'victory');
      expect(g.state.battles).toHaveLength(outcome === 'victory' ? 1 : 0);
      expect(p.fleetLost).not.toBe(true);
    }
  });
  it.each([undefined, 10_000])('Hard reverses toward free colonies at zero gold regardless of legacy price %s', (price) => {
    const map = Array.from({ length: 40 }, (_, id) => ({
      id, name: `Stop ${id}`, x: id, y: 0,
      kind: id >= 28 && id <= 38 ? 'island' as const : 'event' as const,
      event: 'floatingCargo' as const, price,
    }));
    const g = new GameEngine({ map, players: [{ name: 'AI', color: 0, isAI: true, aiDifficulty: 'hard' }], rng: () => 0.5, config: { homeSalary: 0 } });
    g.state.roamers = [];
    const p = g.currentPlayer;
    p.position = 0;
    p.gold = 0;
    p.strategies = ['reverse'];
    expect(aiSeaStrategy(g.state, p, (id, target) => g.canUseStrategy(id, target))).toMatchObject({ card: 'reverse' });
    g.useStrategy('reverse');
    g.spinCompass();
    g.sail();
    g.resolveLanding();
    expect(g.state.owners[p.position]).toBe(p.id);
    expect(p.gold).toBe(0);
  });

  it.each(['easy', 'normal', 'hard'] as const)('%s only uses legal cards across the entire deck', (difficulty) => {
    for (const id of Object.keys(STRATEGIES) as StrategyId[]) {
      const { g, p, node } = setup(id);
      p.aiDifficulty = difficulty;
      g.state.round = 3;
      p.fleet.forEach((s) => { s.durability = 1; });
      if (!STRATEGIES[id].phases.includes('awaitingSpin')) { g.state.phase = 'awaitingToll'; p.position = node; }
      expect(() => g.decideForAI()).not.toThrow();
    }
  });
});

describe('strategy interactions with fleet-loss defeat', () => {
  it('betray preserves a rival last ship and a later battle wipe-out eliminates them', () => {
    const { g, p, rival, node } = setup('betray');
    rival.fleet.splice(2);
    g.useStrategy('betray', rival.id);
    expect(rival.fleet).toHaveLength(1);
    expect(rival.fleetLost).not.toBe(true);
    g.state.strategyUsed = false;
    p.strategies = ['betray'];
    expect(g.canUseStrategy('betray', rival.id)).toBe(false);
    p.position = node;
    rival.fleet[0].durability = 1;
    rival.fleet[0].firepower = 0;
    g.state.phase = 'awaitingToll';
    g.fight();
    g.finishBuilding();
    expect(rival.fleetLost).toBe(true);
    expect(rival.bankrupt).toBe(false);
    expect(g.state).toMatchObject({ phase: 'gameOver', winner: p.id, victory: 'lastAfloat' });
  });
  it('mislead leaves durability at one, not a fleet-loss defeat', () => {
    const { g, rival } = setup('mislead');
    rival.fleet.splice(1);
    rival.fleet[0].durability = 2;
    g.useStrategy('mislead', rival.id);
    expect(rival.fleet[0].durability).toBe(1);
    expect(rival.fleetLost).not.toBe(true);
  });
  it('gale leaves durability at one, not a fleet-loss defeat', () => {
    const { g, rival, node } = setup('gale');
    rival.fleet.splice(1);
    rival.fleet[0].durability = 2;
    g.useStrategy('gale', rival.id);
    g.state.phase = 'awaitingClaim';
    g.state.pendingClaim = node;
    g.decline();
    expect(rival.fleet[0].durability).toBe(1);
    expect(rival.fleetLost).not.toBe(true);
    expect(g.currentPlayer.id).toBe(rival.id);
  });
  it('blockade cannot hide fleet loss or defer its victory settlement', () => {
    const { g, p, rival, node } = setup('blockade');
    g.useStrategy('blockade', rival.id);
    rival.fleet = [];
    g.state.phase = 'awaitingClaim';
    g.state.pendingClaim = node;
    g.decline();
    expect(rival.fleetLost).toBe(true);
    expect(g.state.owners[node]).toBeNull();
    expect(g.state).toMatchObject({ phase: 'gameOver', winner: p.id, victory: 'lastAfloat' });
  });
  it.each(['mislead', 'betray', 'gale', 'blockade', 'exchange', 'plunder'] as const)('%s cannot target an eliminated navigator even if they have gold or ships', (card) => {
    const { g, rival } = setup(card);
    rival.fleetLost = true;
    expect(g.canUseStrategy(card, rival.id)).toBe(false);
    expect(() => g.useStrategy(card, rival.id)).toThrow('Cannot use strategy');
  });
  it('an eliminated navigator cannot repair their way back into the voyage', () => {
    const { g, p } = setup('repair');
    p.fleetLost = true;
    expect(g.canUseStrategy('repair')).toBe(false);
    expect(() => g.useStrategy('repair')).toThrow('Cannot use strategy');
  });
});
