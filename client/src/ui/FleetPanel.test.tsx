import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNationRoster, GameEngine } from '@happy-voyage/shared';

vi.mock('dialog-polyfill', () => ({ default: {} }));
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return { ...actual, createPortal: (node: unknown) => node };
});
vi.mock('../game/GameController', () => ({ gameController: { viewerId: null } }));

import { FleetPanel, fleetDurabilitySummary } from './FleetPanel';
import { setLocale } from '../i18n';

const game = () => new GameEngine({
  players: createNationRoster([{ name: 'Captain', nation: 'Spain' }]),
  rng: () => 0.5,
});

beforeEach(() => {
  vi.stubGlobal('document', { body: {}, documentElement: {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setLocale('en');
});

describe('FleetPanel', () => {
  it('computes fleet summary totals and damaged ship counts', () => {
    const { state } = game();
    const fleet = state.players[0].fleet;
    expect(fleetDurabilitySummary(fleet)).toMatchObject({
      percent: 100,
      damaged: 0,
    });
    fleet[0].durability -= 20;
    fleet[1].durability -= 10;
    const summary = fleetDurabilitySummary(fleet);
    expect(summary.damaged).toBe(2);
    expect(summary.durability).toBe(summary.maxDurability - 30);
    expect(summary.percent).toBeLessThan(100);
  });

  it('renders summary, per-ship durability meters/percentages, and damaged highlights', () => {
    const { state } = game();
    state.players[0].fleet[0].durability = Math.floor(state.players[0].fleet[0].maxDurability / 2);
    const html = renderToStaticMarkup(<FleetPanel players={state.players} state={state} onClose={() => {}} />);
    expect(html).toContain('Total durability');
    expect(html).toContain('1 damaged');
    expect(html).toContain('<meter');
    expect(html).toContain('(50%)');
    expect(html).toContain('class="damaged"');

    setLocale('zh');
    const zh = renderToStaticMarkup(<FleetPanel players={state.players} state={state} onClose={() => {}} />);
    expect(zh).toContain('总耐久');
    expect(zh).toContain('1 艘未满耐久');
    expect(zh).toContain('(50%)');
  });

  it('shows ships docked at colonies along with local repair availability', () => {
    const { state } = game();
    const islands = state.map.filter((node) => node.kind === 'island');
    const repairColony = islands[0];
    const plainColony = islands[1];
    state.owners[repairColony.id] = 0;
    state.owners[plainColony.id] = 0;
    state.buildings[repairColony.id].repairYard = 1;
    const dockedA = state.players[0].fleet.pop()!;
    const dockedB = state.players[0].fleet.pop()!;
    dockedA.durability = 40;
    state.docks[repairColony.id] = [dockedA];
    state.docks[plainColony.id] = [dockedB];

    const html = renderToStaticMarkup(<FleetPanel players={state.players} state={state} onClose={() => {}} />);
    expect(html).toContain('Docked at colonies (2)');
    expect(html).toContain(repairColony.name);
    expect(html).toContain('Repairs at turn start');
    expect(html).toContain(plainColony.name);
    expect(html).toContain('No shipyard or repair yard');

    setLocale('zh');
    const zh = renderToStaticMarkup(<FleetPanel players={state.players} state={state} onClose={() => {}} />);
    expect(zh).toContain('停靠在殖民地（2 艘）');
    expect(zh).toContain('回合开始时免费修满');
    expect(zh).toContain('无造船厂或修船厂');
  });
});
