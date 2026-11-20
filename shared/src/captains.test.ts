import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { CAPTAINS, aiRecruitChoice, captainBonus, recruitOffers } from './captains';
import { foreignTaxDue } from './ranks';

function game() {
  return new GameEngine({ players: [0, 1].map((i) => ({ name: `Sailor ${i}`, color: i, isAI: true })), rng: () => 0 });
}
function land(g: GameEngine, id = g.state.map.find((node) => node.special === 'dragonSnake')!.id) {
  g.state.currentPlayer = 0;
  g.currentPlayer.position = id;
  g.state.phase = 'moving';
  g.resolveLanding();
}

describe('Dragon Snake captains', () => {
  it('draws reproducible unique offers gated by rank and excludes crew', () => {
    const p = game().currentPlayer;
    for (let rank = 0; rank <= 5; rank++) {
      p.rank = rank;
      const offers = recruitOffers(p, () => 0.7);
      expect(offers).toEqual(recruitOffers(p, () => 0.7));
      expect(offers).toHaveLength(3);
      expect(new Set(offers).size).toBe(3);
      expect(offers.every((id) => CAPTAINS.find((c) => c.id === id)!.minRank <= rank)).toBe(true);
    }
    p.rank = 0;
    p.captains = ['ines', 'rui', 'mei'];
    expect(recruitOffers(p, () => 0)).toEqual([]);
  });

  it('pauses, emits an offer, pays once and keeps the toll bonus on repeat landings', () => {
    const g = game();
    const p = g.currentPlayer;
    let offered = false;
    g.on((event) => { if (event.type === 'recruitsOffered') offered = true; });
    land(g);
    expect(offered).toBe(true);
    expect(g.state.phase).toBe('awaitingRecruit');
    const gold = p.gold;
    g.recruitCaptain(0);
    expect(p.gold).toBe(gold - CAPTAINS[0].fee);
    expect(p.captains).toEqual(['ines']);
    expect(g.state.pendingRecruits).toBeNull();
    g.state.owners[1] = 1;
    for (let i = 0; i < 2; i++) {
      const before = p.gold;
      land(g, 1);
      expect(p.gold).toBe(before - Math.ceil(g.state.map[1].toll! * 0.9));
    }
    expect(p.captains).toEqual(['ines']);
    expect(() => g.recruitCaptain(0)).toThrow('Expected phase');
  });

  it('declines and clears offers without charging', () => {
    const g = game();
    const p = g.currentPlayer;
    land(g);
    const gold = p.gold;
    g.declineRecruit();
    expect(p.gold).toBe(gold);
    expect(p.captains).toEqual([]);
    expect(g.state.pendingRecruits).toBeNull();
    expect(g.state.phase).toBe('awaitingSpin');
  });

  it('rejects invalid, unaffordable, duplicate, locked and full-crew choices atomically', () => {
    const g = game();
    const p = g.currentPlayer;
    land(g);
    for (const index of [-1, 99, 0.5, NaN]) expect(() => g.recruitCaptain(index)).toThrow('Unknown');
    p.gold = 0;
    expect(() => g.recruitCaptain(0)).toThrow('Not enough gold');
    p.gold = 1000;
    p.captains = ['ines'];
    expect(() => g.recruitCaptain(0)).toThrow('already aboard');
    g.state.pendingRecruits = ['leonor'];
    expect(() => g.recruitCaptain(0)).toThrow('rank');
    p.captains = ['ines', 'rui', 'mei'];
    expect(() => g.recruitCaptain(0)).toThrow('Crew is full');
    expect(p.gold).toBe(1000);
    expect(g.state.phase).toBe('awaitingRecruit');
  });

  it('continues when no offers are affordable or available', () => {
    for (const owned of [false, true]) {
      const g = game();
      if (owned) g.currentPlayer.captains = ['ines', 'rui', 'mei'];
      else g.currentPlayer.gold = 0;
      land(g);
      expect(g.state.pendingRecruits).toBeNull();
      expect(g.state.phase).toBe('awaitingSpin');
      expect(g.state.log.join(' ')).toContain(owned ? 'crew is full' : 'no affordable captains');
    }
  });

  it('skips recruitment for full crews even with eligible affordable captains available', () => {
    const g = game();
    const p = g.currentPlayer;
    p.rank = 5;
    p.captains = ['ines', 'rui', 'mei'];
    const gold = p.gold;
    const crew = [...p.captains];
    let offered = false;
    g.on((event) => { if (event.type === 'recruitsOffered') offered = true; });
    expect(recruitOffers(p, () => 0)).toHaveLength(3);
    land(g);
    expect(offered).toBe(false);
    expect(g.state.pendingRecruits).toBeNull();
    expect(g.state.phase).toBe('awaitingSpin');
    expect(g.state.currentPlayer).toBe(1);
    expect(g.state.log.join(' ')).toContain('crew is full');
    expect(p.gold).toBe(gold);
    expect(p.captains).toEqual(crew);
  });

  it('applies tax discounts after rank and adds salary at home', () => {
    const g = game();
    const p = g.currentPlayer;
    p.rank = 2;
    p.captains = ['rui', 'gaspar', 'mei'];
    const gold = p.gold;
    land(g, g.state.map.find((node) => node.kind === 'port' && node.id !== p.homePort)!.id);
    expect(p.gold).toBe(gold - Math.ceil(foreignTaxDue(2) * 0.6));
    g.state.currentPlayer = 0;
    p.position = (p.homePort + g.state.map.length - 1) % g.state.map.length;
    g.state.phase = 'spinning';
    g.state.lastSpin = 1;
    const before = p.gold;
    g.sail();
    g.resolveLanding();
    expect(p.gold).toBe(before + g.state.config.homeSalary + 100 + 30);
    expect(captainBonus(p, 'salary')).toBe(30);
  });

  it('AI takes the best affordable offer while preserving 200g, or declines', () => {
    const g = game();
    const p = g.currentPlayer;
    p.gold = 1000;
    land(g);
    expect(aiRecruitChoice(p, g.state.pendingRecruits!)).toBe(1);
    g.decideForAI();
    expect(p.captains).toEqual(['rui']);
    expect(aiRecruitChoice(p, [])).toBeNull();
    p.gold = 200;
    land(g);
    g.decideForAI();
    expect(p.captains).toEqual(['rui']);
    expect(g.state.pendingRecruits).toBeNull();
    p.captains = ['ines', 'rui', 'mei'];
    expect(aiRecruitChoice(p, ['leonor'])).toBeNull();
  });
});
