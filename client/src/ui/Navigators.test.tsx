import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNationRoster, DEFAULT_GAMEPLAY_TUNING, GameEngine } from '@happy-voyage/shared';

vi.mock('../game/GameController', () => ({ gameController: {
  localTuning: DEFAULT_GAMEPLAY_TUNING,
  muted: false, islandsOwnedBy: () => 0, newGame: vi.fn(), displayGold: (p: { gold: number }) => p.gold,
} }));
vi.mock('./SpeedControl', () => ({ SpeedControl: () => null }));
vi.mock('dialog-polyfill', () => ({ default: {} }));
vi.mock('react-dom', async (original) => ({ ...(await original<typeof import('react-dom')>()), createPortal: (node: unknown) => node }));
import { SetupMenu } from './SetupMenu';
import { PlayerBar } from './PlayerBar';
import { FleetPanel } from './FleetPanel';
import { TutorialPanel } from './TutorialPanel';

describe('navigators in the UI', () => {
  it('introduces the selected nation navigator and signature ship on the setup screen', () => {
    const html = renderToStaticMarkup(<SetupMenu onRules={() => {}} />);
    expect(html).toContain('value="Columbus"');
    expect(html).not.toContain('哥伦布');
    expect(html).toContain('Santa María');
    expect(html).toContain('+20 durability, +20 cargo');
    expect(html.match(/role="img"/g)).toHaveLength(11);
    expect(html).toContain('Rival difficulty');
    expect(html).toContain('<option value="normal" selected="">Normal</option>');
    expect(html).toContain('<option value="easy">Easy</option>');
    expect(html).toContain('<option value="hard">Hard</option>');
  });

  it('shows every navigator portrait and nation in the HUD', () => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Me', nation: 'China' }]) });
    const html = renderToStaticMarkup(<PlayerBar state={state} colorBlind={false} paletteToggle={null} onRules={() => {}} onFleet={() => {}} onTutorial={() => {}} />);
    expect(html).toContain('aria-label="Zheng He portrait"');
    expect(html).toContain('aria-label="Columbus portrait"');
    expect(html).toContain('<strong>Columbus</strong>');
    expect(html).toContain('Spain<br/>');
  });

  it('ties numbered chart markers and stat help to the HUD', () => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Me', nation: 'China' }]) });
    const html = renderToStaticMarkup(<PlayerBar state={state} colorBlind paletteToggle={null} onRules={() => {}} onFleet={() => {}} onTutorial={() => {}} />);
    expect(html).toContain('aria-label="Chart marker 1"');
    expect(html).toContain('aria-label="Chart marker 10"');
    expect(html).toContain('Spendable gold for construction');
    expect(html).toContain('Ships docked at colonies are counted separately');
    expect(html).toContain('>Tutorial</button>');
  });

  it('shows colony and strategy card counts for every navigator', () => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Me', nation: 'China' }]) });
    state.players[1].strategies = state.players[1].strategies.slice(0, 1);
    const html = renderToStaticMarkup(<PlayerBar state={state} colorBlind={false} paletteToggle={null} onRules={() => {}} onFleet={() => {}} onTutorial={() => {}} />);
    expect(html).toContain('0 colonies');
    expect(html).toContain('3 cards');
    expect(html).toContain('1 card<');
    expect(html).toContain('Strategy cards currently held by this navigator');
  });

  it('marks the signature ship in the fleet panel', () => {
    vi.stubGlobal('document', { body: null });
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Me', nation: 'England' }]) });
    const html = renderToStaticMarkup(<FleetPanel players={state.players} onClose={() => {}} />);
    expect(html).toContain('Endeavour');
    expect(html).toContain('signature ship');
    for (const stat of ['Durability', 'Firepower', 'Cargo capacity', 'Speed', 'Crew capacity']) {
      const id = html.match(new RegExp(`aria-describedby="([^"]+)">${stat}</button>`))?.[1];
      expect(id).toBeDefined();
      expect(html).toContain(`id="${id}" role="tooltip" hidden=""`);
    }
    vi.unstubAllGlobals();
  });

  it('starts the tutorial with the compass and offers a skip action', () => {
    vi.stubGlobal('document', { body: null });
    const html = renderToStaticMarkup(<TutorialPanel onClose={() => {}} />);
    expect(html).toContain('First voyage · 1 of 4');
    expect(html).toContain('Spin compass');
    expect(html).toContain('Skip tutorial');
    expect(html).toContain('>Next</button>');
    vi.unstubAllGlobals();
  });
});
