import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNationRoster, GameEngine } from '@happy-voyage/shared';

vi.mock('../game/GameController', () => ({ gameController: {
  muted: false, islandsOwnedBy: () => 0, newGame: vi.fn(), displayGold: (p: { gold: number }) => p.gold,
} }));
vi.mock('./SpeedControl', () => ({ SpeedControl: () => null }));
vi.mock('dialog-polyfill', () => ({ default: {} }));
vi.mock('react-dom', async (original) => ({ ...(await original<typeof import('react-dom')>()), createPortal: (node: unknown) => node }));
import { SetupMenu } from './SetupMenu';
import { PlayerBar } from './PlayerBar';
import { FleetPanel } from './FleetPanel';

describe('navigators in the UI', () => {
  it('introduces the selected nation navigator and signature ship on the setup screen', () => {
    const html = renderToStaticMarkup(<SetupMenu onRules={() => {}} />);
    expect(html).toContain('value="Columbus"');
    expect(html).toContain('哥伦布');
    expect(html).toContain('Santa María');
    expect(html).toContain('+20 durability, +20 cargo');
    expect(html.match(/role="img"/g)).toHaveLength(11);
  });

  it('shows every navigator portrait and nation in the HUD', () => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Me', nation: 'China' }]) });
    const html = renderToStaticMarkup(<PlayerBar state={state} onRules={() => {}} onFleet={() => {}} />);
    expect(html).toContain('aria-label="Zheng He portrait"');
    expect(html).toContain('aria-label="Columbus portrait"');
    expect(html).toContain('<strong>Columbus</strong>');
    expect(html).toContain('Spain<br/>');
  });

  it('marks the signature ship in the fleet panel', () => {
    vi.stubGlobal('document', { body: null });
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Me', nation: 'England' }]) });
    const html = renderToStaticMarkup(<FleetPanel players={state.players} onClose={() => {}} />);
    expect(html).toContain('Endeavour');
    expect(html).toContain('signature ship');
    vi.unstubAllGlobals();
  });
});
