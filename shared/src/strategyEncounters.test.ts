import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { aiSeaStrategy } from './ai';
import type { GameEvent, MapNode, SeaEventResult } from './types';

function voyage() {
  let rolls: number[] = [];
  const map: MapNode[] = Array.from({ length: 40 }, (_, id) => ({ id, name: `Stop ${id}`, kind: id === 0 ? 'port' : 'island', toll: 30, x: id, y: 0 }));
  const g = new GameEngine({ map, players: [{ name: 'Captain', color: 0, isAI: true, aiDifficulty: 'hard' }], rng: () => rolls.shift() ?? 0.99, config: { startingStrategies: 0, islandsToWin: 99 } });
  g.state.roamers = [];
  const p = g.currentPlayer;
  const events: GameEvent[] = [];
  g.on((e) => events.push(e));
  const sail = () => { g.spinCompass(); g.sail(); g.resolveLanding(); };
  return { g, p, events, sail, roll: (values: number[]) => { rolls = [...values]; } };
}

describe('strategies during random encounters', () => {
  it('Inspire changes the outcome of a randomly encountered pirate fight', () => {
    const fight = (inspired: boolean) => {
      const { g, p, events, sail, roll } = voyage();
      p.fleet.splice(3);
      for (const ship of p.fleet) { ship.firepower = 10; ship.durability = 10000; }
      p.strategies = ['inspire'];
      if (inspired) g.useStrategy('inspire');
      roll(Array(50).fill(0));
      sail();
      expect(p.fleet.every((ship) => ship.firepower === 10)).toBe(true);
      expect(g.state.owners[2]).toBe(p.id);
      return events.find((e): e is SeaEventResult => e.type === 'seaEvent' && e.event === 'pirates');
    };
    expect(fight(false)).toMatchObject({ outcome: 'defeat', gold: -80 });
    expect(fight(true)).toMatchObject({ outcome: 'victory', gold: 140 });
  });

  it.each([['pirates', 0.1], ['smallMonster', 0.25], ['whirlpool', 0.4], ['largeMonster', 0.94], ['turtle', 0.99]] as const)('Escort blocks a random %s before resolving the destination', (event, selection) => {
    const { g, p, events, sail, roll } = voyage();
    p.strategies = ['escort'];
    g.useStrategy('escort');
    const gold = p.gold;
    const fleet = structuredClone(p.fleet);
    roll([0, 0, selection]);
    sail();
    expect(events.filter((e) => e.type === 'seaEvent')).toMatchObject([{ event, outcome: 'protected' }]);
    expect(p.escortProtection).toBe(false);
    expect(p.gold).toBe(gold);
    expect(p.fleet).toEqual(fleet);
    expect(g.state.owners[2]).toBe(p.id);
  });

  it.each(['pirates', 'smallMonster'] as const)('Escort blocks a roaming %s on the landing space', (kind) => {
    const { g, p, events, sail, roll } = voyage();
    g.state.roamers = [{ id: 0, kind, node: 2 }];
    p.strategies = ['escort'];
    g.useStrategy('escort');
    roll([0]);
    sail();
    expect(events.filter((e) => e.type === 'seaEvent')).toMatchObject([{ event: kind, outcome: 'protected' }]);
    expect(p.escortProtection).toBe(false);
    expect(g.state.roamers[0].node).not.toBe(2);
    expect(g.state.owners[2]).toBe(p.id);
  });

  it.each(['tailwind', 'reverse', 'navigate', 'exchange'] as const)('%s resumes the destination exactly once after a merchant interruption', (card) => {
    const { g, p, events, sail, roll } = voyage();
    p.strategies = [card];
    const destination = card === 'reverse' ? 38 : card === 'tailwind' ? 4 : 6;
    if (card === 'exchange') {
      g.state.players.push({ ...structuredClone(p), id: 1, name: 'Rival', position: 4 });
      g.useStrategy(card, 1);
      expect(p.position).toBe(4);
      expect(g.state.players[1].position).toBe(0);
      expect(g.state.phase).toBe('awaitingSpin');
    }
    roll(card === 'navigate' ? [0, 0.75, 0.5] : [0, 0, 0.75, 0.5]);
    if (card === 'navigate') g.useStrategy(card, destination);
    else {
      if (card !== 'exchange') g.useStrategy(card);
      sail();
    }
    expect(p.position).toBe(destination);
    expect(g.state.phase).toBe('awaitingMerchant');
    expect(g.state.owners[destination]).toBeNull();
    expect(g.canUseStrategy('recall')).toBe(false);
    expect(g.state.strategyUsed).toBe(true);
    const stock = g.state.pendingMerchant!.stock!;
    const gold = p.gold;
    g.buyMerchant(1);
    expect(p.gold).toBe(gold - stock.unitPrice);
    g.declineMerchant();
    expect(g.state.owners[destination]).toBe(p.id);
    expect(events.filter((e) => e.type === 'claimed')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'merchantOffered')).toHaveLength(1);
    g.finishBuilding();
    expect(g.state.strategyUsed).toBe(false);
    expect(g.state.compassMultiplier).toBe(1);
  });

  it.each(['tailwind', 'reverse'] as const)('%s triggers roaming hazards only when landing on them, not when passing by', (card) => {
    const { g, p, events, sail, roll } = voyage();
    const passed = card === 'reverse' ? 39 : 1;
    const landed = card === 'reverse' ? 38 : 4;
    g.state.roamers = [
      { id: 0, kind: 'pirates', node: passed },
      { id: 1, kind: 'smallMonster', node: landed },
    ];
    p.strategies = [card];
    g.useStrategy(card);
    roll([0]);
    sail();
    expect(p.position).toBe(landed);
    expect(events.filter((e) => e.type === 'seaEvent')).toMatchObject([{ event: 'smallMonster', outcome: 'damaged' }]);
    expect(g.state.roamers[0].node).toBe(passed);
    expect(g.state.roamers[1].node).not.toBe(landed);
    expect(g.state.owners[p.position]).toBe(p.id);
  });

  it('Recall returns directly home without crossing hazards or awarding sailing salary', () => {
    const { g, p, events, roll } = voyage();
    p.position = 8;
    g.state.roamers = [{ id: 0, kind: 'pirates', node: 9 }];
    p.strategies = ['recall'];
    const gold = p.gold;
    roll([0, 0]);
    g.useStrategy('recall');
    expect(p.position).toBe(p.homePort);
    expect(g.state.royalAudience?.playerId).toBe(p.id);
    expect(p.gold - gold).toBe(g.state.royalAudience!.reward);
    expect(events.some((e) => e.type === 'seaEvent')).toBe(false);
  });

  it.each(['wyvern', 'whirlpool'] as const)('Navigate resolves a %s relocation without rerolling an encounter', (event) => {
    const { g, p, events, roll } = voyage();
    p.strategies = ['navigate'];
    roll(event === 'wyvern' ? [0, 0.9] : [0, 0.4, 0.9, 0.9]);
    g.useStrategy('navigate', 2);
    expect(g.state.owners[2]).toBeNull();
    if (event === 'wyvern') {
      expect(g.state.phase).toBe('awaitingWyvern');
      g.wyvernFly(6);
    }
    expect(g.state.phase).toBe('moving');
    expect(g.state.strategyUsed).toBe(true);
    g.resolveLanding();
    expect(p.position).toBe(6);
    expect(g.state.owners[6]).toBe(p.id);
    expect(events.filter((e) => e.type === 'seaEvent')).toMatchObject([{ event, outcome: 'relocated' }]);
    expect(events.filter((e) => e.type === 'claimed')).toHaveLength(1);
  });

  it('Escort survives a harmless merchant interruption', () => {
    const { g, p, sail, roll } = voyage();
    p.strategies = ['escort'];
    g.useStrategy('escort');
    roll([0, 0, 0.75, 0.5]);
    sail();
    expect(g.state.phase).toBe('awaitingMerchant');
    expect(p.escortProtection).toBe(true);
    g.declineMerchant();
    expect(p.escortProtection).toBe(true);
  });

  it('Hard uses Reverse to avoid a roaming hazard on a landing space, but not when merely passing by or covered by Escort', () => {
    const { g, p } = voyage();
    for (const node of g.state.map) { node.kind = 'event'; node.event = 'openSea'; }
    p.strategies = ['reverse'];
    g.state.roamers = [{ id: 0, kind: 'pirates', node: 1 }];
    expect(aiSeaStrategy(g.state, p, (id, target) => g.canUseStrategy(id, target))).toBeUndefined();
    g.state.roamers = [{ id: 0, kind: 'pirates', node: 7 }];
    expect(aiSeaStrategy(g.state, p, (id, target) => g.canUseStrategy(id, target))).toMatchObject({ card: 'reverse' });
    p.escortProtection = true;
    expect(aiSeaStrategy(g.state, p, (id, target) => g.canUseStrategy(id, target))).toBeUndefined();
  });

  it.each([false, true])('Hard spends Escort on a landing roamer before estimating the destination storm (roamer: %s)', (roamer) => {
    const { g, p, events, sail, roll } = voyage();
    for (const node of g.state.map) {
      node.kind = 'event';
      node.event = node.id >= 2 && node.id <= 12 ? 'storm' : 'openSea';
    }
    p.strategies = ['reverse'];
    p.escortProtection = true;
    if (roamer) g.state.roamers = [2, 6, 7, 8].map((node, id) => ({ id, kind: 'pirates' as const, node }));
    const choice = aiSeaStrategy(g.state, p, (id, target) => g.canUseStrategy(id, target));
    if (roamer) expect(choice).toMatchObject({ card: 'reverse' });
    else expect(choice).toBeUndefined();
    roll([0]);
    sail();
    expect(events.filter((e) => e.type === 'seaEvent')).toMatchObject(roamer
      ? [{ event: 'pirates', outcome: 'protected' }, { event: 'storm', outcome: 'damaged' }]
      : [{ event: 'storm', outcome: 'protected' }]);
    expect(p.escortProtection).toBe(false);
  });
});
