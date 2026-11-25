import { describe, expect, it } from 'vitest';
import { GameEngine, SEA_RULES } from './engine';
import { localize, rankName } from './i18n';
import { playerMerit, RANKS } from './ranks';

function game(isAI = false) {
  return new GameEngine({ players: [{ name: 'Navigator', nation: 'England', color: 0, isAI }], rng: () => 0 });
}
function land(g: GameEngine, nodeId = g.currentPlayer.homePort) {
  g.currentPlayer.position = nodeId;
  g.state.phase = 'moving';
  g.resolveLanding();
}
function colony(g: GameEngine) {
  const id = g.state.map.find((node) => node.kind === 'island')!.id;
  g.state.owners[id] = 0;
  return id;
}

describe('military ranks', () => {
  it('starts every navigator as an Ensign', () => {
    const { currentPlayer } = game();
    expect(rankName(currentPlayer.rank, 'en')).toBe('Ensign');
    expect(rankName(currentPlayer.rank, 'zh')).toBe('少尉');
  });

  it.each([false, true])('promotes one rank and exposes the purse and announcement (AI=%s)', (ai) => {
    const g = game(ai);
    const p = g.currentPlayer;
    const id = colony(g);
    g.state.buildings[id] = { lumberMill: 3 };
    expect(playerMerit(g.state, 0)).toBe(175);
    const before = p.gold;
    const events: string[] = [];
    g.on((event) => events.push(event.type));
    land(g);
    expect(p.rank).toBe(1);
    expect(p.gold).toBe(before + RANKS[1].purse + 90);
    expect(g.state.royalAudience).toMatchObject({ promoted: true, rank: 1, reward: 200 });
    expect(events).toContain('royalAudience');
    expect(g.state.log.join(' ')).toContain('promotes Navigator to Lieutenant (Junior Grade)!');
    const announcement = g.state.royalAudience!.text!;
    expect(localize('en', announcement, g.state)).not.toMatch(/[\u4e00-\u9fff]/);
    expect(localize('zh', announcement, g.state)).toContain('晋升为中尉');
    expect(g.state.logText!.map((entry) => localize('zh', entry, g.state)).join(' ')).toContain('晋升为中尉');
    expect(() => g.resolveLanding()).toThrow();
  });

  it('rewards only new high-water achievements and does not farm repeat visits', () => {
    const g = game();
    const p = g.currentPlayer;
    const id = colony(g);
    land(g);
    g.state.buildings[id] = { lumberMill: 1 };
    const before = p.gold;
    land(g);
    expect(p.gold).toBe(before + 50 + 15);
    expect(g.state.royalAudience).toMatchObject({ promoted: false, reward: 50 });
    land(g);
    expect(p.gold).toBe(before + 50 + 2 * 15);
    expect(g.state.royalAudience?.message).toContain('awaits greater deeds');
  });

  it('does not promote for wealth alone, or on passing home', () => {
    const g = game();
    const p = g.currentPlayer;
    p.gold = 100000;
    land(g);
    expect(p.rank).toBe(0);
    colony(g);
    p.position = (p.homePort - 1 + g.state.map.length) % g.state.map.length;
    g.spinCompass(); g.sail(); g.resolveLanding();
    expect(p.rank).toBe(0);
  });

  it('pays the rank salary bonus on a pass, without an audience', () => {
    const g = game();
    const p = g.currentPlayer;
    p.rank = 2;
    g.state.roamers = [];
    p.revivalProtection = true;
    p.position = (p.homePort - 1 + g.state.map.length) % g.state.map.length;
    const before = p.gold;
    g.spinCompass(); g.sail(); g.resolveLanding();
    expect(p.gold).toBe(before + g.state.config.homeSalary + RANKS[2].salary);
    expect(g.state.royalAudience).toBeNull();
  });

  it('discounts foreign tax, including the amount transferred to the host', () => {
    const g = new GameEngine({ players: [
      { name: 'Guest', nation: 'England', color: 0, isAI: false },
      { name: 'Host', nation: 'Spain', color: 1, isAI: true },
    ] });
    const [p, host] = g.state.players;
    p.rank = 2;
    const before = p.gold;
    const hostBefore = host.gold;
    const tax = Math.ceil(SEA_RULES.foreignTax * (1 - RANKS[2].taxDiscount));
    land(g, host.homePort);
    expect(p.gold).toBe(before - tax);
    expect(host.gold).toBe(hostBefore + tax);
  });

  it('caps at Captain and pays no reward without new deeds', () => {
    const g = game();
    g.currentPlayer.rank = RANKS.length - 1;
    const before = g.currentPlayer.gold;
    land(g);
    expect(g.currentPlayer.gold).toBe(before);
    expect(g.currentPlayer.rank).toBe(5);
    expect(g.state.royalAudience).toMatchObject({ promoted: false, reward: 0 });
  });
});
