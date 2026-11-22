import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameEngine } from '@happy-voyage/shared';
import { RecruitPanel } from './RecruitPanel';

vi.mock('../game/GameController', () => ({ gameController: { recruitCaptain: vi.fn(), declineRecruit: vi.fn() } }));

describe('RecruitPanel', () => {
  function state() {
    const { state } = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    state.pendingRecruits = ['ines'];
    return state;
  }
  it('shows English names, ships, fee, rank and controls', () => {
    const html = renderToStaticMarkup(<RecruitPanel state={state()} />);
    expect(html).toContain('Ines Tidewalker');
    expect(html).toContain('Explorer');
    expect(html).toContain('Requires Commoner · 180g');
    expect(html).toContain('Recruit Ines Tidewalker');
    expect(html).toContain('Decline recruitment');
    expect(html).not.toContain('disabled');
  });
  it('handles no offers and disables unaffordable or full crew recruitment', () => {
    const s = state();
    s.pendingRecruits = null;
    expect(renderToStaticMarkup(<RecruitPanel state={s} />)).not.toContain('Recruit Ines');
    s.pendingRecruits = ['ines'];
    s.players[0].gold = 0;
    expect(renderToStaticMarkup(<RecruitPanel state={s} />)).toContain('disabled');
    s.players[0].gold = 1000;
    s.players[0].captains = ['rui', 'mei', 'gaspar'];
    const html = renderToStaticMarkup(<RecruitPanel state={s} />);
    expect(html).toContain('Crew is full');
    expect(html).toContain('disabled');
  });
});
