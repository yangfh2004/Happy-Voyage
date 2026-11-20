import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameEngine } from '@happy-voyage/shared';

vi.mock('../game/GameController', () => ({ gameController: {
  spinId: 0, feedback: {}, headline: null, timings: { spin: 0 }, waiting: false,
  canBuild: () => false,
} }));
vi.mock('./Compass', () => ({ Compass: () => null }));
import { ActionPanel } from './ActionPanel';

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
});
