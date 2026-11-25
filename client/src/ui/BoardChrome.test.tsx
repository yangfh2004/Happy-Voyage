import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNationRoster, GameEngine, playerName, tx, type GameState } from '@happy-voyage/shared';

vi.mock('../game/GameController', () => ({ gameController: {
  displayGold: (p: { gold: number }) => p.gold,
  islandsOwnedBy: (id: number) => (id === 1 ? 1 : 0),
  visibleLogText: () => [], feedback: { logTones: new Map() }, decline: vi.fn(),
  get landingTarget() { return null; },
} }));
import { canEndTurn, endTurnAction, HelmCard, LandingHeading, NextStop, VoyageBottomBar, VoyageTopBar } from './BoardChrome';
import { LogPanel } from './LogPanel';
import { gameController } from '../game/GameController';
import { setLocale } from '../i18n';

const game = () => new GameEngine({ players: createNationRoster([{ name: 'Captain', nation: 'Spain' }]) });
afterEach(() => {
  vi.restoreAllMocks();
  setLocale('en');
});

describe('board chrome', () => {
  it.each([false, true])('shows each seat number once in the portrait strip with color-blind mode %s', (colorBlind) => {
    const { state } = game();
    const html = renderToStaticMarkup(<VoyageTopBar state={state} colorBlind={colorBlind} onMenu={() => {}} menuOpen={false} />);
    const names = Array.from(html.matchAll(/<strong>(.*?)<\/strong>/g), match => match[1].replace(/<[^>]+>/g, ''));
    expect(names).toEqual(state.players.map(p => `${p.id + 1}${colorBlind ? ' ·' : ''} ${playerName(p, 'en')}`));
    expect(html.match(/class="seat-number"/g)?.length ?? 0).toBe(colorBlind ? 0 : state.players.length);
  });
  it('shows the next known landing and hides missing or invalid targets', () => {
    const { state } = game();
    expect(renderToStaticMarkup(<NextStop state={state} />)).toBe('');
    const target = vi.spyOn(gameController, 'landingTarget', 'get');
    target.mockReturnValue({ nodeId: -1, playerId: 0, steps: 4, preview: false });
    expect(renderToStaticMarkup(<NextStop state={state} />)).toBe('');
    const island = state.map.find((node) => node.kind === 'island')!;
    target.mockReturnValue({ nodeId: island.id, playerId: 0, steps: 4, preview: false });
    const html = renderToStaticMarkup(<NextStop state={state} />);
    expect(html).toContain('NEXT STOP');
    expect(html).toContain(island.name);
    expect(html).toContain('4 steps');
  });
  it('labels unowned and rival-owned landing cards with the current treasury and claim cost', () => {
    const { state } = game();
    const island = state.map.find((node) => node.kind === 'island')!;
    state.phase = 'awaitingClaim';
    state.pendingClaim = island.id;
    expect(renderToStaticMarkup(<LandingHeading state={state} />)).toContain('Unowned');
    expect(renderToStaticMarkup(<LandingHeading state={state} />)).not.toContain('Cost:');
    state.owners[island.id] = 1;
    expect(renderToStaticMarkup(<LandingHeading state={state} />)).toContain('Owned by Juliana');
  });
  it('shows player resources, current turn and accessible menu control', () => {
    const { state } = game();
    const html = renderToStaticMarkup(<VoyageTopBar state={state} colorBlind onMenu={() => {}} menuOpen={false} />);
    expect(html).toContain('CURRENT TURN');
    expect(html).toContain('Turn:');
    expect(html).toContain('aria-controls="voyage-menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('3200');
    expect(html).toContain('1 ·');
  });
  it('shows colony and strategy card counts for every navigator', () => {
    const { state } = game();
    state.players[1].strategies = state.players[1].strategies.slice(0, 1);
    const html = renderToStaticMarkup(<VoyageTopBar state={state} colorBlind={false} onMenu={() => {}} menuOpen={false} />);
    expect(html.match(/>Colonies<\/span> /g)).toHaveLength(state.players.length);
    expect(html).toContain('>Colonies</span> 1 · ');
    expect(html).toContain('>Strategy cards</span> 1</span>');
    expect(html).toContain('>Colonies</span> 0 · ');
    expect(html).toContain('>Strategy cards</span> 3</span>');
    expect(html).toContain(`>Gold</span> ${state.players[0].gold} · `);
  });
  it('shows the current human and handles an empty fleet', () => {
    const { state } = game();
    state.players[state.currentPlayer].fleet = [];
    const html = renderToStaticMarkup(<HelmCard state={state} colorBlind={false} atHelm />);
    expect(html).toContain('YOUR TURN');
    expect(html).toContain('<dd>0</dd>');
    expect(html).toContain('<dt>Rank</dt><dd>Ensign</dd>');
    setLocale('zh');
    expect(renderToStaticMarkup(<HelmCard state={state} colorBlind={false} atHelm />)).toContain('<dt>军衔</dt><dd>少尉</dd>');
  });
  it('only enables End Turn for supported decline decisions at the local helm', () => {
    const { state } = game();
    for (const phase of ['awaitingClaim', 'awaitingRecruit', 'awaitingBarter', 'awaitingBuild', 'awaitingMarket', 'awaitingCargoMarket'] as GameState['phase'][]) {
      state.phase = phase;
      expect(canEndTurn(state, true)).toBe(true);
      expect(canEndTurn(state, false)).toBe(false);
    }
    for (const phase of ['awaitingSpin', 'moving', 'spinning', 'awaitingToll', 'gameOver'] as GameState['phase'][]) {
      state.phase = phase;
      expect(canEndTurn(state, true)).toBe(false);
    }
    expect(renderToStaticMarkup(<VoyageBottomBar state={state} atHelm={false} />)).toContain('disabled=""');
  });
  it('maps continuations to their exact panel actions without skipping unresolved choices', () => {
    const { state } = game();
    for (const [phase, action] of Object.entries({ awaitingClaim: 'decline', awaitingRecruit: 'declineRecruit', awaitingBarter: 'declineBarter', awaitingBuild: 'finishBuilding', awaitingMarket: 'finishMarket', awaitingCargoMarket: 'finishTrading' })) {
      state.phase = phase as GameState['phase'];
      expect(endTurnAction(state, true)).toBe(action);
      expect(endTurnAction(state, false)).toBeNull();
    }
    state.phase = 'awaitingLottery';
    expect(endTurnAction(state, true)).toBeNull();
    state.lottery = { playerId: 0, nodeId: 0, secondsLeft: 0, picks: [], draw: { playerId: 0, round: 1, nodeId: 0, picks: [], balls: [], matches: [], spent: 0, prize: 0 } };
    expect(endTurnAction(state, true, false)).toBeNull();
    expect(endTurnAction(state, true, true)).toBe('finishLottery');
    state.phase = 'awaitingMerchant';
    expect(endTurnAction(state, true)).toBeNull();
    state.pendingMerchant = { good: 'Wine', quantity: 1, gold: 100 };
    expect(endTurnAction(state, true)).toBe('declineMerchant');
    state.phase = 'awaitingMistDuel';
    state.mistDuel = { nodeId: 0, hermitId: null, stonesLeft: 15, lastTurn: null, result: null };
    expect(endTurnAction(state, true)).toBe('leaveMistIsland');
    state.mistDuel.hermitId = 'brook';
    expect(endTurnAction(state, true)).toBeNull();
    state.mistDuel.result = { round: 1, playerId: 0, nodeId: 0, hermitId: 'brook', outcome: 'loss', strategy: null };
    expect(endTurnAction(state, true)).toBe('leaveMistIsland');
    state.phase = 'awaitingWyvern';
    expect(endTurnAction(state, true)).toBeNull();
    state.phase = 'awaitingToll';
    const island = state.map.find(n => n.kind === 'island')!;
    state.players[0].position = island.id;
    state.owners[island.id] = 1;
    expect(endTurnAction(state, true)).toBeNull();
    island.toll = 0;
    expect(endTurnAction(state, true)).toBe('payToll');
  });
  it('renders empty logs and limits recent events while preserving tones', () => {
    const { state } = game();
    expect(renderToStaticMarkup(<LogPanel state={state} log={[]} tones={new Map()} limit={3} />)).not.toContain('latest');
    const html = renderToStaticMarkup(<LogPanel state={state} log={['Old', 'One', 'Two', 'Three'].map((text) => tx(text, text))} tones={new Map([[3, 'income']])} limit={3} />);
    expect(html).not.toContain('Old');
    expect(html).toContain('latest income');
    expect(html.indexOf('Three')).toBeLessThan(html.indexOf('Two'));
  });
});
