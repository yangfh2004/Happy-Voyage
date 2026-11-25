import { tx, STRATEGIES, type StrategyId } from '@happy-voyage/shared';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNationRoster, GameEngine, MAX_FLEET_SIZE, type ShipType } from '@happy-voyage/shared';

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
vi.mock('../game/EventBus', () => ({ EventBus: { emit: vi.fn() } }));
vi.mock('dialog-polyfill', () => ({ default: { registerDialog: vi.fn() } }));
import { ActionPanel } from './ActionPanel';
import { ShipMarketPanel } from './ShipMarketPanel';
import { MarketPanel } from './MarketPanel';
import { CampaignPanel } from './CampaignPanel';
import { RouteDetails } from './RouteDetails';
import { TransferContents } from './TransferPanel';
import { gameController } from '../game/GameController';
import { setLocale } from '../i18n';

describe('retreat selector', () => {
  it.each(['en', 'zh'] as const)('does not offer retreat settings outside the pre-battle prompt in %s', locale => {
    const engine = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }], rng: () => .5 });
    const node = engine.state.map.find(n => n.kind === 'island')!;
    engine.currentPlayer.position = node.id; engine.state.owners[node.id] = 0;
    setLocale(locale);
    try {
      for (const phase of ['awaitingSpin', 'moving', 'awaitingBattle', 'awaitingBuild'] as const) {
        engine.state.phase = phase;
        const html = renderToStaticMarkup(<ActionPanel state={engine.state} />);
        expect(html).not.toContain('Auto-withdraw after losing');
        expect(html).not.toContain('损失几艘船后自动撤退');
        expect(html).not.toContain('value="quarter"');
      }
    } finally { setLocale('en'); }
  });

  it.each(['en', 'zh'] as const)('renders all four choices and the legacy default in the %s battle prompt', locale => {
    const engine = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }], rng: () => .5 });
    const node = engine.state.map.find(n => n.kind === 'island')!;
    engine.currentPlayer.position = node.id; engine.state.owners[node.id] = 1; engine.state.phase = 'awaitingToll';
    delete engine.currentPlayer.retreatThreshold;
    setLocale(locale);
    try {
      const html = renderToStaticMarkup(<ActionPanel state={engine.state} />);
      expect(html).toContain(locale === 'en' ? 'Auto-withdraw after losing' : '损失几艘船后自动撤退');
      expect(html).toContain('min-height:44px');
      expect(html).toContain('<option value="half" selected="">');
      for (const option of ['quarter', 'half', 'threeQuarters', 'last']) expect(html).toContain(`value="${option}"`);
      engine.currentPlayer.retreatThreshold = 'last';
      expect(renderToStaticMarkup(<ActionPanel state={engine.state} />)).toContain('<option value="last" selected="">');
      if (locale === 'en') expect(html).not.toMatch(/\p{Script=Han}/u);
    } finally { setLocale('en'); }
  });
});

describe('fleet capacity at a colony', () => {
  it.each(['en', 'zh'] as const)('shows the cap and disables boarding at capacity in %s', (locale) => {
    const game = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }], rng: () => 0.5 });
    const { state, currentPlayer: player } = game;
    const island = state.map.find((node) => node.kind === 'island')!;
    state.owners[island.id] = player.id;
    player.position = island.id;
    while (player.fleet.length < MAX_FLEET_SIZE) game.addShipToFleet(player.id, 'cargo');
    game.addShipToFleet(player.id, 'explorer');
    setLocale(locale);
    try {
      const html = renderToStaticMarkup(<TransferContents state={state} />);
      expect(html).toContain(locale === 'en' ? 'Fleet 10/10' : '舰队 10/10');
      expect(html).toMatch(locale === 'en' ? /<button disabled="">Board / : /<button disabled="">让/);
      if (locale === 'en') expect(html).not.toMatch(/\p{Script=Han}/u);
      state.phase = 'awaitingBuild';
      game.dockShip(player.fleet[0].id);
      const available = renderToStaticMarkup(<TransferContents state={state} />);
      expect(available).toMatch(locale === 'en' ? /<button>Board / : /<button>让/);
    } finally {
      setLocale('en');
    }
  });
});

describe('colony return', () => {
  it.each(['en', 'zh'] as const)('offers the direct return on a human turn in %s', (locale) => {
    const game = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    const { state } = game;
    const island = state.map.find((node) => node.kind === 'island')!;
    state.owners[island.id] = 0;
    setLocale(locale);
    try {
      const html = renderToStaticMarkup(<ActionPanel state={state} />);
      expect(html).toContain(locale === 'en' ? 'Return to Madeira' : '每 12 回合可用一次');
      if (locale === 'en') expect(html).not.toMatch(/\p{Script=Han}/u);
      game.currentPlayer.nextColonyReturnRound = 12;
      expect(renderToStaticMarkup(<ActionPanel state={state} />)).not.toContain(locale === 'en' ? 'Return to Madeira' : '每 12 回合可用一次');
    } finally {
      setLocale('en');
    }
  });
});

describe('fleet-loss defeat', () => {
  it.each(['en', 'zh'] as const)('explains a player’s defeat after battle in %s', (locale) => {
    const game = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }], rng: () => 0.5, config: { battleMode: 'auto' } });
    const { state } = game;
    const island = state.map.find((node) => node.kind === 'island')!;
    state.owners[island.id] = 1;
    game.currentPlayer.position = island.id;
    game.currentPlayer.fleet.splice(1);
    game.currentPlayer.fleet.forEach((ship) => { ship.durability = 1; });
    state.phase = 'moving';
    game.resolveLanding();
    game.fight();
    Object.assign(gameController, { islandsOwnedBy: (id: number) => game.islandsOwnedBy(id), netWorth: (id: number) => game.netWorth(id) });
    setLocale(locale);
    try {
      const html = renderToStaticMarkup(<ActionPanel state={state} />);
      expect(html).toContain(locale === 'en' ? 'Defeat for You: no ships remain in their sailing fleet.' : 'You 的航行舰队已无船只，航程失败。');
      if (locale === 'en') expect(html).not.toMatch(/\p{Script=Han}/u);
    } finally {
      setLocale('en');
    }
  });
});

describe('campaign UI', () => {
  it('shows distinct pending and paid missions after claiming a real colony', () => {
    const game = new GameEngine({ campaign: { stage: 'first-voyage', navigator: { name: 'You', nation: 'Spain' } }, rng: () => .5 });
    const { state } = game;
    const island = state.map.find((node) => node.kind === 'island')!;
    game.useStrategy('navigate', island.id);
    const html = renderToStaticMarkup(<CampaignPanel campaign={state.campaign!} />);
    expect(html).toContain('First Voyage');
    expect(html).toContain('Complete · 150g awarded');
    expect(html).toContain('0 / 1 · 250g reward');
  });

  it('shows a campaign loss without treating it as a rival victory', () => {
    const game = new GameEngine({ campaign: { stage: 'merchant-charter', navigator: { name: 'You', nation: 'Spain' } }, rng: () => .5 });
    game.state.config.battleMode = 'auto';
    const { state } = game;
    game.currentPlayer.gold = 0;
    game.useStrategy('navigate', state.map.find((node) => node.event === 'storm')!.id);
    const html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('Stage failed: The Merchant Charter');
    expect(html).toContain('Your navigator went bankrupt.');
    expect(html).not.toContain('Next stage');
  });
});

describe('turn controls', () => {
  it('offers rival and eligible colony targets and renders the entire deck in English', () => {
    const engine = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Leader', color: 1, isAI: true }, { name: 'Bankrupt', color: 2, isAI: true }], config: { startingStrategies: 0 } });
    const { state } = engine;
    state.players[2].bankrupt = true;
    const islands = state.map.filter((n) => n.kind === 'island').slice(0, 2);
    islands.forEach((n) => { state.owners[n.id] = 1; });
    state.docks[islands[1].id] = [state.players[1].fleet.pop()!];
    engine.currentPlayer.strategies = Object.keys(STRATEGIES) as StrategyId[];
    vi.mocked(gameController.canUseStrategy).mockImplementation((id, target) => engine.canUseStrategy(id, target));
    const html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('Target for Plunder');
    expect(html).toContain('Target for Incite Revolt');
    expect(html).toContain('<option value="1" selected="">Leader</option>');
    expect(html).not.toContain('>Bankrupt</option>');
    for (const card of Object.values(STRATEGIES)) {
      expect(html).toContain(card.name);
      expect(html).not.toContain(card.chineseName);
    }
    expect(vi.mocked(gameController.canUseStrategy)).toHaveBeenCalledWith('plunder', 1);
    expect(vi.mocked(gameController.canUseStrategy)).toHaveBeenCalledWith('revolt', islands[0].id);
    vi.mocked(gameController.canUseStrategy).mockReturnValue(false);
  });
  it('puts the first spin and landing actions before strategy cards', () => {
    const engine = new GameEngine({ players: createNationRoster([{ name: 'You', nation: 'Spain' }]), rng: () => 0, config: { battleMode: 'auto' } });
    const { state } = engine;
    const expectBeforeStrategyCards = (action: string) => {
      const html = renderToStaticMarkup(<ActionPanel state={state} />);
      const strategyCards = html.indexOf('<section aria-label="Strategy cards">');
      expect(strategyCards).toBeGreaterThan(-1);
      expect(html.slice(0, strategyCards)).toContain(action);
    };

    expectBeforeStrategyCards('Spin compass <kbd>');
    engine.spinCompass();
    engine.sail();
    engine.resolveLanding();
    expect(state.owners[state.players[0].position]).toBe(0);
    expect(state.phase).not.toBe('awaitingClaim');
  });
});

describe('build menu', () => {
  it('matches auto-resolve when a reboarded flagship is tied for lowest durability', () => {
    const engine = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }], rng: () => .5, config: { battleMode: 'auto' } });
    const { state, currentPlayer: player } = engine;
    const node = state.map.find((n) => n.kind === 'island')!;
    const [flagship, escort] = player.fleet;
    player.fleet = [flagship, escort];
    Object.assign(flagship, { type: 'warship', signature: true, durability: 100, maxDurability: 100, firepower: 20 });
    Object.assign(escort, { type: 'warship', signature: false, durability: 100, maxDurability: 100, firepower: 20 });
    state.players[1].fleet = [{ ...state.players[1].fleet[0], durability: 40, firepower: 75 }];
    player.position = node.id;
    state.owners[node.id] = player.id;
    state.phase = 'awaitingBuild';
    engine.dockShip(flagship.id);
    engine.boardShip(flagship.id);
    state.owners[node.id] = 1;
    state.phase = 'awaitingToll';

    const html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(engine.fight([flagship.id, escort.id])?.outcome).toBe('victory');
    expect(escort.durability).toBe(25);
    expect(flagship.durability).toBe(100);
    expect(html).toContain('(likely victory)');
  });

  it('updates the toll battle forecast after playing Inspire without changing ship stats', () => {
    const engine = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }] });
    const { state } = engine;
    const player = engine.currentPlayer;
    const node = state.map.find((n) => n.kind === 'island')!;
    player.position = node.id;
    state.owners[node.id] = 1;
    state.phase = 'awaitingToll';
    player.fleet.splice(1);
    state.players[1].fleet.splice(1);
    const attacker = player.fleet[0];
    const defender = state.players[1].fleet[0];
    attacker.firepower = 30;
    attacker.durability = 200;
    defender.firepower = 10;
    defender.durability = 120;
    player.strategies = ['inspire'];
    expect(renderToStaticMarkup(<ActionPanel state={state} />)).toContain('(likely draw)');
    engine.useStrategy('inspire');
    expect(renderToStaticMarkup(<ActionPanel state={state} />)).toContain('(likely victory)');
    expect(attacker.firepower).toBe(30);
    expect(attacker.durability).toBe(200);
    expect(defender.durability).toBe(120);
  });
  it('shows strategy names, descriptions, destinations, hand counts and revealed hoard', () => {
    const engine = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }] });
    engine.currentPlayer.strategies = ['navigate', 'locate'];
    engine.currentPlayer.knownHoard = engine.state.hoardNode;
    vi.mocked(gameController.canUseStrategy).mockImplementation((id, target) => engine.canUseStrategy(id, target));
    const html = renderToStaticMarkup(<ActionPanel state={engine.state} />);
    expect(html).toContain('Navigate');
    expect(html).toContain('Reveal the buried hoard');
    expect(html).toContain('Navigate destination');
    expect(html).toContain('Rival: 3 cards');
    engine.state.players[1].strategies = ['inspire'];
    const singleCardHtml = renderToStaticMarkup(<ActionPanel state={engine.state} />);
    expect(singleCardHtml).toContain('Rival: 1 card');
    expect(singleCardHtml).not.toContain('Rival: 1 cards');
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
    gameController.headline = { text: 'King promotes you to Lieutenant (Junior Grade)!', message: tx('King promotes you to Lieutenant (Junior Grade)!', '国王将你晋升为中尉！'), tone: 'gain', royal: true };
    gameController.feedback.summary = { tolls: [], claims: [], netGold: 0 };
    const html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('Since your last turn');
    expect(html).toContain('King promotes you to Lieutenant (Junior Grade)!');
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
    let html = renderToStaticMarkup(<ShipMarketPanel state={state} />);
    expect(html).toContain('Skeleton Island ship market');
    expect(html).toContain('Buy Explorer (180g)');
    expect(html).toContain('48/80 durability');
    expect(html).toContain('Sell Warship 1 (225g)');
    state.marketStock = [];
    engine.currentPlayer.fleet.splice(1);
    engine.currentPlayer.gold = 0;
    html = renderToStaticMarkup(<ShipMarketPanel state={state} />);
    expect(html).toContain('Sold out.');
    expect(html).toContain('<button disabled="">Sell Warship 1');
    state.marketStock = ['explorer'];
    html = renderToStaticMarkup(<ShipMarketPanel state={state} />);
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
    expect(html).toContain('Ships &amp; cargo transfer');
  });

  it('shows transfer stock, cargo, docked ships and the minimum fleet restriction', () => {
    const { state, currentPlayer: player } = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }] });
    const node = state.map.find((n) => n.kind === 'island')!;
    player.position = node.id;
    state.owners[node.id] = 0;
    state.phase = 'awaitingBuild';
    let html = renderToStaticMarkup(<TransferContents state={state} />);
    expect(html).toContain('No docked ships.');
    expect(html).not.toContain('Dock ships here for free repairs');
    state.buildings[node.id].shipyard = 1;
    html = renderToStaticMarkup(<TransferContents state={state} />);
    expect(html).toContain('Dock ships here for free repairs at the start of your next turn.');
    expect(html).toMatch(/disabled="">AUTO load specialties/);
    expect(html).toContain('No specialties in stock. Build a Collection Field here to produce them.');
    state.stockpiles[node.id].specialties = { Wine: 4 };
    html = renderToStaticMarkup(<TransferContents state={state} />);
    expect(html).not.toMatch(/disabled="">AUTO load specialties/);
    expect(html).not.toContain('No specialties in stock.');
    state.docks[node.id].push(...player.fleet.splice(1));
    player.fleet[0].cargo = { Wine: 3 };
    state.stockpiles[node.id].iron = 7;
    html = renderToStaticMarkup(<TransferContents state={state} />);
    expect(html).toContain('Board Cargo Ship');
    expect(html).toContain('Cargo 3/25');
    expect(html).toContain('Unload Wine from');
    expect(html).toMatch(/<th scope="row">iron<\/th><td>7<\/td><td>0<\/td>/);
    expect(html).toMatch(/disabled="">Dock/);
    expect(html).toContain('Wine 3');
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
    expect(html).toContain(`Pay ${island.toll}g toll`);
    expect(html).toContain(`${island.toll! * 2}g double toll`);
    expect(html).toContain('Defenders: 4 ships');
    expect(html).toContain('Fight <kbd>F</kbd>');
    expect(html).toContain('Choose ships for battle · 4/4');
    expect(html).toMatch(/<input(?=[^>]*disabled)(?![^>]*checked)[^>]*\/><span>Cargo Ship/);
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

    const html = renderToStaticMarkup(<MarketPanel state={game.state} />);
    expect(html).toContain('24-hour market');
    expect(html).toContain('Market stock: 16 · Aboard: 3');
    expect(html).toContain('Buy · 26g');
    expect(html).toContain('Sell · 20g');
    expect(html).toContain('Done trading');

    player.gold = 0;
    player.fleet[1].cargo = {};
    const empty = renderToStaticMarkup(<MarketPanel state={game.state} />);
    expect(empty).toContain('<button disabled="">Buy</button>');
    expect(empty).toContain('<button disabled="">Sell</button>');
  });
  it('shows the victory screen when one navigator holds every new continent', () => {
    const engine = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false, nation: 'Spain' }, { name: 'Rival', color: 1, isAI: true }] });
    const { state } = engine;
    const islands = state.map.filter((node) => node.kind === 'island');
    for (const island of islands.slice(1)) state.owners[island.id] = 0;
    engine.currentPlayer.gold = 10_000;
    engine.currentPlayer.position = islands[0].id;
    state.phase = 'moving';
    engine.resolveLanding();
    engine.finishBuilding();
    Object.assign(gameController, { islandsOwnedBy: (id: number) => engine.islandsOwnedBy(id), netWorth: (id: number) => engine.netWorth(id) });
    const html = renderToStaticMarkup(<ActionPanel state={state} />);
    expect(html).toContain('Victory! Every new continent flies your flag.');
    expect(html).toContain('All 40 new continents are colonies of Spain.');
  });
});

describe('hot-seat handoff', () => {
  it('hides the turn behind a pass-the-device screen until the next human confirms', () => {
    const engine = new GameEngine({ players: createNationRoster([{ name: 'Ana', nation: 'Spain' }, { name: 'Bo', nation: 'China' }]) });
    const controller = gameController as unknown as { awaitingHandoff: boolean; humanCount: number };
    engine.state.currentPlayer = 1;
    controller.humanCount = 2;
    controller.awaitingHandoff = true;
    const html = renderToStaticMarkup(<ActionPanel state={engine.state} />);
    expect(html).toContain('Pass the device to Bo');
    expect(html).toContain('P2 · China');
    expect(html).not.toContain('Spin compass');
    controller.awaitingHandoff = false;
    expect(renderToStaticMarkup(<ActionPanel state={engine.state} />)).toContain('Your turn, Bo.');
    controller.humanCount = 0;
  });
});
