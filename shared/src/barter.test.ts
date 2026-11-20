import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { barterOffers, fleetQuantity, GOOD_VALUES } from './barter';
import { aiBarterChoice } from './ai';
import { cargoLoad } from './ships';

function game() {
  return new GameEngine({ players: [0, 1].map((i) => ({ name: `Captain ${i}`, color: i, isAI: true })), rng: () => 0.5 });
}
function land(g: GameEngine) {
  g.currentPlayer.position = g.state.map.find((node) => node.special === 'wind')!.id;
  g.state.phase = 'moving';
  g.resolveLanding();
}
describe('Wind Island barter', () => {
  it('generates reproducible affordable offers with more valuable goods and total value', () => {
    const g = game();
    const p = g.currentPlayer;
    p.fleet[0].cargo = { lumber: 5, iron: 4, Wine: 3, Silver: 2 };
    const offers = barterOffers(p, () => 0.5);
    expect(offers).toEqual(barterOffers(p, () => 0.5));
    expect(offers).toHaveLength(3);
    for (const o of offers) {
      expect(o.giveQty).toBeLessThanOrEqual(fleetQuantity(p, o.give));
      expect(GOOD_VALUES[o.receive]).toBeGreaterThan(GOOD_VALUES[o.give]);
      expect(o.receiveQty * GOOD_VALUES[o.receive]).toBeGreaterThan(o.giveQty * GOOD_VALUES[o.give]);
    }
    land(g);
    expect(g.state.phase).toBe('awaitingBarter');
    expect(g.state.currentPlayer).toBe(0);
    expect(g.state.pendingBarter).toEqual(offers);
  });
  it('swaps cargo across a full fleet without exceeding any ship capacity', () => {
    const g = game();
    const p = g.currentPlayer;
    p.fleet.forEach((ship) => { ship.cargo = { lumber: ship.cargoCapacity }; });
    land(g);
    const o = g.state.pendingBarter![0];
    const before = fleetQuantity(p, o.give);
    g.acceptBarter(0);
    expect(fleetQuantity(p, o.give)).toBe(before - o.giveQty);
    expect(fleetQuantity(p, o.receive)).toBe(o.receiveQty);
    expect(p.fleet.every((ship) => cargoLoad(ship) <= ship.cargoCapacity)).toBe(true);
    expect(g.state.pendingBarter).toBeNull();
    expect(g.state.currentPlayer).toBe(1);
    expect(() => g.acceptBarter(0)).toThrow('Expected phase');
  });
  it('rejects unknown indices and missing cargo atomically', () => {
    const g = game();
    g.currentPlayer.fleet[0].cargo = { lumber: 4 };
    land(g);
    for (const index of [-1, 9, 0.5, NaN]) expect(() => g.acceptBarter(index)).toThrow('Unknown');
    g.currentPlayer.fleet[0].cargo = {};
    const before = JSON.stringify(g.state);
    expect(() => g.acceptBarter(0)).toThrow('Not enough cargo');
    expect(JSON.stringify(g.state)).toBe(before);
  });
  it('declines without changing cargo or gold', () => {
    const g = game();
    const p = g.currentPlayer;
    p.fleet[0].cargo = { iron: 3 };
    land(g);
    const before = JSON.stringify(p);
    g.declineBarter();
    expect(JSON.stringify(p)).toBe(before);
    expect(g.state.pendingBarter).toBeNull();
    expect(g.state.phase).toBe('awaitingSpin');
  });
  it('logs an empty cargo fallback without free gold', () => {
    const g = game();
    const p = g.currentPlayer;
    land(g);
    expect(g.state.pendingBarter).toBeNull();
    expect(p.gold).toBe(g.state.config.startingGold);
    expect(g.state.log.join(' ')).toContain('No barter today');
  });
  it('AI selects the highest profit affordable offer and completes the decision', () => {
    const g = game();
    g.currentPlayer.fleet[0].cargo = { lumber: 4, Wine: 4 };
    land(g);
    const offers = g.state.pendingBarter!;
    const index = aiBarterChoice(g.currentPlayer, offers)!;
    const gains = offers.map((o) => o.receiveQty * GOOD_VALUES[o.receive] - o.giveQty * GOOD_VALUES[o.give]);
    expect(gains[index]).toBe(Math.max(...gains));
    expect(aiBarterChoice(g.currentPlayer, [])).toBeNull();
    g.decideForAI();
    expect(g.state.phase).toBe('awaitingSpin');
    expect(g.state.log.join(' ')).toContain('barters');
  });
});
