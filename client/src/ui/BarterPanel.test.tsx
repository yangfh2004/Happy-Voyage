import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameEngine } from '@happy-voyage/shared';
import { BarterPanel } from './BarterPanel';

vi.mock('../game/GameController', () => ({ gameController: { acceptBarter: vi.fn(), declineBarter: vi.fn() } }));

describe('BarterPanel', () => {
  it('shows quantities, values and accept/decline controls', () => {
    const { state } = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    state.pendingBarter = [{ give: 'lumber', giveQty: 3, receive: 'Silk', receiveQty: 1 }];
    state.players[0].fleet[0].cargo.lumber = 9;
    const html = renderToStaticMarkup(<BarterPanel state={state} />);
    expect(html).toContain('<summary>Fleet cargo</summary>');
    expect(html).toContain('9 lumber');
    expect(html).toContain('Give 3 lumber (30g value)');
    expect(html).toContain('Receive 1 Silk (90g value)');
    expect(html).toContain('Accept offer 1');
    expect(html).toContain('Decline barter');
    state.pendingBarter = null;
    expect(renderToStaticMarkup(<BarterPanel state={state} />)).not.toContain('Accept offer');
  });
});
