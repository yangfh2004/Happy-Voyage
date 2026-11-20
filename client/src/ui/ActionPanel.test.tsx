import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameEngine } from '@happy-voyage/shared';

vi.mock('../game/GameController', () => ({ gameController: {
  spinId: 0, feedback: {}, headline: null, timings: { spin: 0 }, waiting: false,
  canBuild: () => false,
  shownPosition: (player: { position: number }) => player.position,
} }));
vi.mock('./Compass', () => ({ Compass: () => null }));
import { ActionPanel } from './ActionPanel';
import { RouteDetails } from './RouteDetails';

describe('build menu', () => {
  it('shows empty, upgraded and maxed buildings with costs and disabled actions', () => {
    const { state } = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    const node = state.map.find((n) => n.kind === 'island')!;
    state.players[0].position = node.id;
    state.owners[node.id] = 0;
    state.phase = 'awaitingBuild';
    let html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('None');
    expect(html).toContain('Build (100g)');
    expect(html).toContain('disabled');
    state.buildings[node.id] = { lumberMill: 2, repairYard: 1 };
    html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('Medium');
    expect(html).toContain('Upgrade (300g)');
    expect(html).toContain('Max level');
    expect(html).toContain('Done');
  });

  it('shows the same stockpile and production rates in the build menu and route details', () => {
    const { state } = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    const [, island] = state.map.filter((node) => node.kind === 'island');
    state.players[0].position = island.id;
    state.owners[island.id] = 0;
    state.phase = 'awaitingBuild';
    state.buildings[island.id] = { lumberMill: 2, ironMine: 3, collectionField: 1 };
    state.stockpiles[island.id] = { lumber: 7, iron: 5, specialties: { Sugar: 3 } };

    for (const panel of [<ActionPanel state={state} />, <RouteDetails state={state} />]) {
      const html = renderToStaticMarkup(panel);
      expect(html).toContain('Stored: 7 lumber · 5 iron · 3 Sugar');
      expect(html).toContain('Per round: +2 lumber · +6 iron · +1 Sugar');
      expect(html.match(/Stored:/g)).toHaveLength(1);
    }
  });
});
