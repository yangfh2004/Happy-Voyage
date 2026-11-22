import { describe, expect, it } from 'vitest';
import { GameEngine, SEA_RULES } from './engine';
import { localize, nodeName } from './i18n';
import { LOTTERY } from './lottery';
import { createDefaultMap } from './map';
import { createNationRoster, type Nation } from './nations';
import type { EventKind, SpecialKind } from './types';

const players = [0, 1].map((i) => ({ name: `Captain ${i}`, color: i, isAI: true }));
function game(rng = 0.1) { return new GameEngine({ players, rng: () => rng }); }
function land(g: GameEngine, id: number) {
  g.currentPlayer.position = id;
  g.state.phase = 'moving';
  g.resolveLanding();
}

describe('living sea board', () => {
  const nations = ['Spain', 'Netherlands', 'England', 'Portugal', 'China', 'France', 'Japan', 'Germany', 'Italy', 'Korea'] as const satisfies readonly Nation[];

  it.each(nations)('starts a human %s voyage with all other nations at their own ports', (nation) => {
    const g = new GameEngine({ players: createNationRoster([{ name: 'Navigator', nation }]) });
    g.start();

    expect(g.currentPlayer).toMatchObject({ name: 'Navigator', nation, isAI: false });
    expect(g.state.phase).toBe('awaitingSpin');
    expect(g.state.players.slice(1).map((player) => [player.nation, player.isAI])).toEqual(
      nations.filter((other) => other !== nation).map((other) => [other, true]),
    );
    expect(new Set(g.state.players.map((player) => player.homePort)).size).toBe(nations.length);
    expect(new Set(g.state.players.map((player) => player.color)).size).toBe(nations.length);
    for (const player of g.state.players) {
      expect(player.position).toBe(player.homePort);
      expect(g.state.map[player.homePort]).toMatchObject({ kind: 'port', nation: player.nation, name: `${player.nation} Port` });
    }
  });

  it('preserves multiple distinct human picks and rejects duplicate nations', () => {
    const picks = [{ name: 'First', nation: 'Korea' }, { name: 'Second', nation: 'Portugal' }] as const;
    const roster = createNationRoster(picks);
    expect(roster.filter((player) => !player.isAI)).toMatchObject(picks);
    expect(roster.slice(2).every((player) => player.isAI)).toBe(true);
    expect(() => createNationRoster([picks[0], picks[0]])).toThrow('Nation already picked: Korea');
  });

  it.each(['Spain', 'England'])('settles %s home salary only after the ship arrives', (nation) => {
    const g = new GameEngine({ players: [{ ...players[0], nation }], rng: () => 0 });
    const p = g.currentPlayer;
    p.position = (p.homePort - 2 + g.state.map.length) % g.state.map.length;
    const before = p.gold;
    g.spinCompass();
    g.sail();
    expect(p.gold).toBe(before);
    g.resolveLanding();
    expect(p.gold).toBe(before + g.state.config.homeSalary);
    expect(() => g.resolveLanding()).toThrow();
    expect(p.gold).toBe(before + g.state.config.homeSalary);
  });

  it('settles salary once at the end of a relocation chain to a national home port', () => {
    const rng = [0.6, 0.3];
    const g = new GameEngine({ players: [{ ...players[0], nation: 'England' }], config: { startingStrategies: 0 }, rng: () => rng.shift()!, map: [
      { id: 0, name: 'First Wyvern', kind: 'event', event: 'wyvern', x: 0, y: 0 },
      { id: 1, name: 'England', kind: 'port', nation: 'England', x: 1, y: 0 },
      { id: 2, name: 'Second Wyvern', kind: 'event', event: 'wyvern', x: 2, y: 0 },
      { id: 3, name: 'Spain', kind: 'port', nation: 'Spain', x: 3, y: 0 },
    ] });
    const p = g.currentPlayer;
    const before = p.gold;
    land(g, 0);
    g.wyvernFly(2);
    expect(p.position).toBe(2);
    expect(p.gold).toBe(before);
    g.resolveLanding();
    g.wyvernFly(1);
    expect(p.position).toBe(1);
    expect(p.gold).toBe(before);
    g.resolveLanding();
    expect(p.gold).toBe(before + g.state.config.homeSalary);
    expect(g.state.log.filter((line) => line.includes('royal salary'))).toHaveLength(1);
  });
  it('assigns chosen nations before seat fallbacks without sharing home ports', () => {
    const g = new GameEngine({ players: [
      { ...players[0] },
      { ...players[1], nation: 'Spain' },
      { ...players[0], nation: 'England' },
      { ...players[1], nation: 'England' },
      { ...players[0], nation: 'Atlantis' },
    ] });
    const homes = g.state.players.map((player) => player.homePort);
    expect(new Set(homes).size).toBe(5);
    expect(g.state.map[homes[1]].nation).toBe('Spain');
    expect(g.state.map[homes[2]].nation).toBe('England');
    expect(g.state.map[homes[0]].nation).toBe('Netherlands');
    expect(g.state.players.every((player) => player.position === player.homePort)).toBe(true);
  });
  it('has 70 unique stops, forty colonies, seven distinct specials and ten national ports', () => {
    const map = createDefaultMap();
    expect(map).toHaveLength(70);
    expect(new Set(map.map((n) => n.name)).size).toBe(70);
    expect(map.filter((n) => n.kind === 'island')).toHaveLength(40);
    expect(new Set(map.filter((n) => n.kind === 'special').map((n) => n.special)).size).toBe(7);
    expect(new Set(map.filter((n) => n.kind === 'port').map((n) => n.nation)).size).toBe(10);
    expect(map.every((n, i) => n.id === i && n.x > 0 && n.y > 0)).toBe(true);
    expect(map.filter((n) => n.kind === 'event').every((n) => !/Waters \d/.test(n.name))).toBe(true);
  });

  it('starts each seat at its own port and transfers foreign tax', () => {
    const g = game();
    const [a, b] = g.state.players;
    expect(a.homePort).not.toBe(b.homePort);
    expect(b.position).toBe(b.homePort);
    const gold = a.gold;
    land(g, b.homePort);
    expect(a.gold).toBe(gold - SEA_RULES.foreignTax);
    expect(b.gold).toBe(gold + SEA_RULES.foreignTax);
  });

  it('pays an unplayed port tax to the crown, with no salary at a foreign port', () => {
    const g = game();
    const p = g.currentPlayer;
    const gold = p.gold;
    land(g, g.state.map.filter((n) => n.kind === 'port')[2].id);
    expect(p.gold).toBe(gold - SEA_RULES.foreignTax);
    expect(g.state.players[1].gold).toBe(gold);
  });

  it.each(['skeleton', 'treasure', 'mist', 'revival', 'wind', 'dragonSnake'] as SpecialKind[])('resolves %s and logs its effect', (special) => {
    const g = game();
    const p = g.currentPlayer;
    g.state.owners[1] = 0;
    land(g, g.state.map.find((n) => n.special === special)!.id);
    expect(g.state.phase).toBe(special === 'skeleton' ? 'awaitingMarket' : special === 'treasure' ? 'awaitingLottery' :
      special === 'mist' ? 'awaitingMistDuel' : special === 'dragonSnake' ? 'awaitingRecruit' : 'awaitingSpin');
    expect(g.state.log.length).toBeGreaterThan(0);
    expect(g.state.log.some((line) => /\b[Yy]our\b|\bYou win/.test(line))).toBe(false);
    expect(g.state.log.slice(0, 2).every((line) => line.includes(p.name))).toBe(true);
    if (special === 'revival') expect(p.revivalProtection).toBe(false);
    if (special === 'dragonSnake') expect(g.state.pendingRecruits).toHaveLength(3);
    if (special === 'wind') expect(p.gold).toBe(g.state.config.startingGold);
    if (special === 'treasure') expect(g.state.lottery).toMatchObject({ playerId: p.id, picks: [], secondsLeft: LOTTERY.timerSeconds, draw: null });
  });

  it.each(['skeleton', 'treasure', 'mist', 'revival', 'wind', 'dragonSnake', 'nightless'] as const)('logs arrival at %s in one language at a time', (special) => {
    const g = game();
    const node = g.state.map.find((n) => n.special === special)!;
    const logStart = g.state.log.length;
    land(g, node.id);
    const visit = g.state.logText![logStart];
    expect(g.state.log[logStart]).toContain(node.name);
    expect(g.state.log[logStart]).not.toMatch(/\p{Script=Han}/u);
    expect(localize('zh', visit, g.state)).toContain(nodeName(node, 'zh'));
    expect(localize('zh', visit, g.state)).not.toContain(node.name);
  });

  it.each(['treasure', 'dragonSnake', 'nightless', 'wind', 'skeleton'] as SpecialKind[])('handles empty purse and colonies at %s', (special) => {
    const g = game();
    const p = g.currentPlayer;
    p.gold = 0;
    land(g, g.state.map.find((n) => n.special === special)!.id);
    expect(p.gold).toBe(0);
    expect(p.bankrupt).toBe(false);
  });

  it('loses a lottery and keeps a captain after a full toll', () => {
    const g = game(0.99);
    const p = g.currentPlayer;
    land(g, g.state.map.find((n) => n.special === 'treasure')!.id);
    g.buyLotteryNumber(1);
    g.drawLottery();
    g.finishLottery();
    expect(p.gold).toBe(g.state.config.startingGold - LOTTERY.ticketPrice);
    g.state.currentPlayer = 0;
    p.captains = ['ines'];
    g.state.owners[1] = 1;
    const gold = p.gold;
    land(g, 1);
    g.payToll();
    expect(p.gold).toBe(gold - g.state.map[1].toll!);
    expect(p.captains).toEqual(['ines']);
  });

  it.each(['storm', 'pirates', 'smallMonster', 'largeMonster', 'turtle', 'whirlpool'] as EventKind[])('revival blocks one %s hazard', (event) => {
    const g = game();
    const p = g.currentPlayer;
    p.revivalProtection = true;
    land(g, g.state.map.find((n) => n.event === event)!.id);
    expect(p.gold).toBe(g.state.config.startingGold);
    expect(p.revivalProtection).toBe(false);
    expect(g.state.phase).toBe('awaitingSpin');
  });

  it('bounds wyvern chains even on an all-event route', () => {
    const g = new GameEngine({ players, rng: () => 0, map: [{ id: 0, name: 'Wyvern', kind: 'event', event: 'wyvern', x: 0, y: 0 }] });
    g.spinCompass();
    g.sail();
    let resolutions = 0;
    while ((g.state.phase === 'moving' || g.state.phase === 'awaitingWyvern') && resolutions < 10) {
      if (g.state.phase === 'awaitingWyvern') g.wyvernFly(0);
      else { resolutions++; g.resolveLanding(); }
    }
    expect(resolutions).toBe(5);
    expect(g.state.phase).toBe('awaitingSpin');
    expect(() => g.resolveLanding()).toThrow('Expected phase moving');
  });
});
