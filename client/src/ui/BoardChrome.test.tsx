import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNationRoster, GameEngine, tx, type GameState } from '@happy-voyage/shared';

vi.mock('../game/GameController', () => ({ gameController: {
  displayGold: (p: { gold: number }) => p.gold,
  visibleLogText: () => [], feedback: { logTones: new Map() }, decline: vi.fn(),
} }));
import { canEndTurn, HelmCard, VoyageBottomBar, VoyageTopBar } from './BoardChrome';
import { LogPanel } from './LogPanel';

const game = () => new GameEngine({ players: createNationRoster([{ name: 'Captain', nation: 'Spain' }]) });

describe('board chrome', () => {
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
