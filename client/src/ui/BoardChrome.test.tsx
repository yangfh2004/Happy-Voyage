import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNationRoster, GameEngine, tx, type GameState } from '@happy-voyage/shared';

vi.mock('../game/GameController', () => ({ gameController: {
  displayGold: (p: { gold: number }) => p.gold,
  visibleLogText: () => [], feedback: { logTones: new Map() }, decline: vi.fn(),
  get landingTarget() { return null; },
} }));
import { canEndTurn, HelmCard, LandingHeading, NextStop, VoyageBottomBar, VoyageTopBar } from './BoardChrome';
import { LogPanel } from './LogPanel';
import { gameController } from '../game/GameController';

const game = () => new GameEngine({ players: createNationRoster([{ name: 'Captain', nation: 'Spain' }]) });
afterEach(() => vi.restoreAllMocks());

describe('board chrome', () => {
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
    expect(renderToStaticMarkup(<LandingHeading state={state} />)).toContain(`Cost: ${island.price}g`);
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
    expect(html).toContain('1400');
    expect(html).toContain('1 ·');
  });
  it('shows the current human and handles an empty fleet', () => {
    const { state } = game();
    state.players[state.currentPlayer].fleet = [];
    const html = renderToStaticMarkup(<HelmCard state={state} colorBlind={false} atHelm />);
    expect(html).toContain('YOUR TURN');
    expect(html).toContain('<dd>0</dd>');
    expect(html).toContain('Rank');
  });
  it('only enables End Turn for supported decline decisions at the local helm', () => {
    const { state } = game();
    for (const phase of ['awaitingClaim', 'awaitingRecruit', 'awaitingBarter', 'awaitingMerchant'] as GameState['phase'][]) {
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
  it('renders empty logs and limits recent events while preserving tones', () => {
    const { state } = game();
    expect(renderToStaticMarkup(<LogPanel state={state} log={[]} tones={new Map()} limit={3} />)).not.toContain('latest');
    const html = renderToStaticMarkup(<LogPanel state={state} log={['Old', 'One', 'Two', 'Three'].map((text) => tx(text, text))} tones={new Map([[3, 'income']])} limit={3} />);
    expect(html).not.toContain('Old');
    expect(html).toContain('latest income');
    expect(html.indexOf('Three')).toBeLessThan(html.indexOf('Two'));
  });
});
