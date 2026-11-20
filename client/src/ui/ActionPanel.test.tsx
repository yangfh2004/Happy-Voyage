import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameEngine, type ShipType } from '@happy-voyage/shared';

vi.mock('../game/GameController', () => ({ gameController: {
  spinId: 0, feedback: {}, headline: null, timings: { spin: 0 }, waiting: false,
  canBuild: () => false,
  canUseStrategy: vi.fn(() => false),
  canBuildShip: vi.fn(() => false),
  canBuyUsedShip: vi.fn(() => false),
  canSellShip: vi.fn(() => false),
  shownPosition: (player: { position: number }) => player.position,
} }));
vi.mock('./Compass', () => ({ Compass: () => null }));
vi.mock('dialog-polyfill', () => ({ default: { registerDialog: vi.fn() } }));
import { ActionPanel } from './ActionPanel';
import { RouteDetails } from './RouteDetails';
import { TransferContents } from './TransferPanel';
import { gameController } from '../game/GameController';

describe('build menu', () => {
  it('shows strategy names, descriptions, destinations, hand counts and revealed hoard', () => {
    const engine = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }] });
    engine.currentPlayer.strategies = ['navigate', 'locate'];
    engine.currentPlayer.knownHoard = engine.state.hoardNode;
    vi.mocked(gameController.canUseStrategy).mockImplementation((id, target) => engine.canUseStrategy(id, target));
    const html = renderToStaticMarkup(<ActionPanel state={engine.state} />);
    expect(html).toContain('Navigate · 导航');
    expect(html).toContain('Reveal the buried hoard');
    expect(html).toContain('Navigate destination');
    expect(html).toContain('Rival: 3 cards');
    expect(html).toContain('Buried hoard:');
    expect(html).toContain('<button>Use Locate</button>');
    engine.state.strategyUsed = true;
    expect(renderToStaticMarkup(<ActionPanel state={engine.state} />)).toContain('<button disabled="">Use Locate</button>');
    engine.currentPlayer.strategies = [];
    expect(renderToStaticMarkup(<ActionPanel state={engine.state} />)).toContain('No strategy cards.');
    vi.mocked(gameController.canUseStrategy).mockReturnValue(false);
  });
  it('keeps royal announcements visible alongside the turn summary', () => {
    const { state } = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    gameController.headline = { text: 'King promotes you to Knight (骑士)!', tone: 'gain', royal: true };
    gameController.feedback.summary = { tolls: [], claims: [], netGold: 0 };
    const html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('Since your last turn');
    expect(html).toContain('King promotes you to Knight (骑士)!');
    gameController.headline = null;
    gameController.feedback.summary = null;
  });
  it('shows market stock, prices, worn condition and empty or unavailable trades', () => {
    const engine = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    const { state } = engine;
    engine.currentPlayer.position = state.map.find((node) => node.special === 'skeleton')!.id;
    state.phase = 'moving';
    engine.resolveLanding();
    vi.mocked(gameController.canBuyUsedShip).mockImplementation((type) => engine.canBuyUsedShip(type));
    vi.mocked(gameController.canSellShip).mockImplementation((id) => engine.canSellShip(id));
    let html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('Skeleton Island ship market');
    expect(html).toContain('Buy Explorer (180g)');
    expect(html).toContain('48/80 durability');
    expect(html).toContain('Sell Warship 1 (225g)');
    state.marketStock = [];
    engine.currentPlayer.fleet.splice(1);
    engine.currentPlayer.gold = 0;
    html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('Sold out.');
    expect(html).toContain('<button disabled="">Sell Warship 1');
    state.marketStock = ['explorer'];
    html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('<button disabled="">Buy Explorer');
  });
  it('shows empty, upgraded and maxed buildings with costs and disabled actions', () => {
    const { state } = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    const node = state.map.find((n) => n.kind === 'island')!;
    state.players[0].position = node.id;
    state.owners[node.id] = 0;
    state.phase = 'awaitingBuild';
    let html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('None');
    expect(html).toContain('Build (100g)');
    expect(html).toContain('Build a shipyard to launch ships.');
    expect(html).toContain('disabled');
    state.buildings[node.id] = { lumberMill: 2, repairYard: 1 };
    html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('Medium');
    expect(html).toContain('Upgrade (300g)');
    expect(html).toContain('Max level');
    expect(html).toContain('Done');
    expect(html).toContain('Transfers');
  });

  it('shows transfer stock, cargo, docked ships and the minimum fleet restriction', () => {
    const { state, currentPlayer: player } = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    const node = state.map.find((n) => n.kind === 'island')!;
    player.position = node.id;
    state.owners[node.id] = 0;
    state.phase = 'awaitingBuild';
    let html = renderToStaticMarkup(<TransferContents state={state} />);
    expect(html).toContain('No docked ships.');
    expect(html).toContain('AUTO load specialties');
    state.docks[node.id].push(...player.fleet.splice(1));
    player.fleet[0].cargo = { Wine: 3 };
    state.stockpiles[node.id].iron = 7;
    html = renderToStaticMarkup(<TransferContents state={state} />);
    expect(html).toContain('Board Cargo Ship');
    expect(html).toContain('Cargo 3/25');
    expect(html).toContain('Unload Wine from');
    expect(html).toContain('iron: 7');
    expect(html).toMatch(/disabled="">Dock/);
    expect(html).toContain('Load onto ship');
  });

  it('shows material prices and why a ship order is unavailable', () => {
    const engine = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    const { state } = engine;
    const node = state.map.find((n) => n.kind === 'island')!;
    state.players[0].position = node.id;
    state.owners[node.id] = 0;
    state.phase = 'awaitingBuild';
    state.buildings[node.id] = { shipyard: 1 };
    vi.mocked(gameController.canBuildShip).mockImplementation((type: ShipType) => engine.canBuildShip(type));

    let html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('2 lumber · 1 iron');
    expect(html).toContain('<button disabled="">Build Explorer</button>');
    expect(html).toContain('Not enough materials.');
    state.stockpiles[node.id] = { lumber: 2, iron: 1, specialties: {} };
    html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('<button>Build Explorer</button>');
    expect(html).toContain('<button disabled="">Build Cargo Ship</button>');
    expect(html).toContain('Requires a medium shipyard.');
    expect(html).toContain('Requires a large shipyard.');
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

  it('offers pay toll or fight at a rival colony with the stakes', () => {
    const engine = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }] });
    const { state } = engine;
    const island = state.map.find((node) => node.kind === 'island')!;
    state.owners[island.id] = 1;
    engine.currentPlayer.position = island.id;
    state.phase = 'moving';
    engine.resolveLanding();
    const html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain(`Rival&#x27;s colony at ${island.name}`);
    expect(html).toContain(`Pay <strong>${island.toll}g</strong> toll`);
    expect(html).toContain(`${island.toll! * 2}g double toll`);
    expect(html).toContain('Defenders: 3 ships');
    expect(html).toContain('Fight <kbd>F</kbd>');
  });
});

describe('market menu', () => {
  it('shows actionable quotes for the selected ship and the Nightless stock', () => {
    const game = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    const player = game.currentPlayer;
    player.position = game.state.map.find((node) => node.special === 'nightless')!.id;
    game.state.phase = 'moving';
    game.resolveLanding();
    player.fleet[1].cargo.Wine = 3;

    const html = renderToStaticMarkup(<ActionPanel state={game.state} />);
    expect(html).toContain('24-hour market');
    expect(html).toContain('Market stock: 16 · Aboard: 3');
    expect(html).toContain('Buy · 26g');
    expect(html).toContain('Sell · 20g');
    expect(html).toContain('Done trading');

    player.gold = 0;
    player.fleet[1].cargo = {};
    const empty = renderToStaticMarkup(<ActionPanel state={game.state} />);
    expect(empty).toContain('<button disabled="">Buy</button>');
    expect(empty).toContain('<button disabled="">Sell</button>');
  });
});
