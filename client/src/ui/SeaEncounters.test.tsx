import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SEA_EVENT_NAMES, type EventKind, type SeaEventResult } from '@happy-voyage/shared';

const hooks = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useEffect: () => {},
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => { hooks.values[index] = value; }];
  },
}));
vi.mock('dialog-polyfill', () => ({ default: { registerDialog: vi.fn() } }));
vi.mock('../game/EventBus', () => {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  return { EventBus: {
    on: (name: string, fn: (...args: unknown[]) => void) => listeners.set(name, [...(listeners.get(name) ?? []), fn]),
    emit: (name: string, ...args: unknown[]) => listeners.get(name)?.forEach((fn) => fn(...args)),
  } };
});

import { gameController, SEA_NOTICE_DURATION_MS, SEA_NOTICE_LIMIT } from '../game/GameController';
import { EventBus } from '../game/EventBus';
import { ActionPanel } from './ActionPanel';
import { SeaChoicePanel } from './SeaChoicePanel';
import { SeaNotifications, SEA_ICONS } from './SeaNotifications';

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...elements(child.props.children as ReactNode)];
  });
}
function panel() {
  hooks.index = 0;
  return SeaChoicePanel({ state: gameController.state! });
}
function click(text: string) {
  const button = elements(panel()).find((el) => el.type === 'button' && el.props.children === text)!;
  (button.props.onClick as () => void)();
}
let moveId = 0;
EventBus.on('animate-move', (move: { id: number }) => { moveId = move.id; });

function start(ai = false, rivalAI = true) {
  gameController.newGame([{ name: 'Captain', color: 0, isAI: ai }, { name: 'Rival', color: 1, isAI: rivalAI }], { battleMode: 'auto' });
  const state = gameController.state!;
  state.roamers = [];
  return state;
}

function startAtSea(ai = false, rivalAI = true) {
  const state = start(ai, rivalAI);
  const sea = state.map.filter((node) => node.kind === 'sea');
  state.players.forEach((player, i) => { player.position = sea[i].id; });
  state.turnStartPosition = state.players[state.currentPlayer].position;
  return state;
}

function land(event: EventKind, ai = false, rivalAI = true) {
  const state = start(ai, rivalAI);
  state.map[2] = { ...state.map[2], kind: 'event', event };
  state.players[0].fleet[0].cargo.Silk = 3;
  state.players[0].strategies = [];
  if (ai) vi.advanceTimersByTime(700);
  else gameController.spinCompass();
  gameController.finishSpin(gameController.spinId);
  vi.mocked(Math.random).mockReturnValue(0.99);
  EventBus.emit('move-complete', moveId);
  vi.mocked(Math.random).mockReturnValue(0);
  return state;
}

beforeEach(() => {
  hooks.values = [];
  hooks.index = 0;
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => { gameController.quit(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('sea notifications', () => {
  function startWithSalvage(rivalAI = true) {
    startAtSea(false, rivalAI);
    gameController.salvageWreck();
  }

  function addNotice() {
    const state = gameController.state!;
    gameController.spinCompass();
    gameController.finishSpin(gameController.spinId);
    const { position } = state.players[state.currentPlayer];
    state.map[position] = { ...state.map[position], kind: 'sea', event: undefined };
    vi.mocked(Math.random).mockReturnValue(0.99);
    EventBus.emit('move-complete', moveId);
    vi.mocked(Math.random).mockReturnValue(0);
    gameController.confirmHandoff();
    gameController.salvageWreck();
  }

  it('keeps only the three newest banners while preserving all outcomes in the log', () => {
    startWithSalvage(false);
    for (let i = 0; i < 5; i++) addNotice();
    const ids = gameController.seaNotices.map((notice) => notice.id);
    expect(ids).toHaveLength(SEA_NOTICE_LIMIT);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(gameController.state!.log.filter((line) => line.includes('Wreck salvage:'))).toHaveLength(6);
    const html = renderToStaticMarkup(<SeaNotifications notices={gameController.seaNotices} onDismiss={() => {}} />);
    expect(html.match(/role="status"/g)).toHaveLength(3);
  });

  it('expires each banner after five seconds without expiring a newer one early', () => {
    startWithSalvage(false);
    vi.advanceTimersByTime(SEA_NOTICE_DURATION_MS - 1000);
    expect(gameController.seaNotices).toHaveLength(1);
    addNotice();
    const newest = gameController.seaNotices[0].id;
    vi.advanceTimersByTime(1000);
    expect(gameController.seaNotices.map((notice) => notice.id)).toEqual([newest]);
    vi.advanceTimersByTime(SEA_NOTICE_DURATION_MS - 1000);
    expect(gameController.seaNotices).toHaveLength(0);
    expect(gameController.state!.log.filter((line) => line.includes('Wreck salvage:'))).toHaveLength(2);
  });

  it('cleans banner timers on quit and does not carry banners into a new voyage', () => {
    startWithSalvage();
    gameController.quit();
    expect(gameController.seaNotices).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    startWithSalvage();
    startWithSalvage();
    expect(gameController.seaNotices).toHaveLength(1);
  });

  it.each(Object.keys(SEA_EVENT_NAMES) as EventKind[])('renders a %s outcome with its icon and player', (event) => {
    const outcome: SeaEventResult = { type: 'seaEvent', playerId: 0, event, outcome: 'gold', gold: 70 };
    const html = renderToStaticMarkup(<SeaNotifications notices={[{ id: 1, event: outcome, playerName: 'Captain' }]} onDismiss={() => {}} />);
    expect(html).toContain(SEA_EVENT_NAMES[event] + '! Gold recovered');
    expect(html).toContain(SEA_ICONS[event]);
    expect(html).toContain('gained 70g');
    expect(html).toContain('Captain');
    expect(html).toContain('role="status"');
  });

  it('shows losses, sunk ships, and supports dismissing without losing later events', () => {
    land('pirates');
    expect(gameController.seaNotices).toHaveLength(1);
    const notice = gameController.seaNotices[0];
    const event: SeaEventResult = { type: 'seaEvent', playerId: 0, event: 'pirates', outcome: 'defeat', gold: -80, shipsLost: [2] };
    const html = renderToStaticMarkup(<SeaNotifications notices={[{ ...notice, event }]} onDismiss={() => {}} />);
    expect(html).toContain('Pirates! Defeated — lost 80g, 1 ship sunk');
    const tree = SeaNotifications({ notices: [notice], onDismiss: (id) => gameController.dismissSeaNotice(id) });
    const dismiss = elements(tree).find((el) => el.type === 'button')!;
    (dismiss.props.onClick as () => void)();
    expect(gameController.seaNotices).toHaveLength(0);
  });

  it('renders nothing for an empty queue', () => {
    expect(renderToStaticMarkup(<SeaNotifications notices={[]} onDismiss={() => {}} />)).not.toContain('role="status"');
  });
});

describe('human sea choices wired to the real engine', () => {
  function controls() {
    hooks.index = 0;
    return elements(ActionPanel({ state: gameController.state! })).filter((el) => el.type === 'button');
  }

  it.each([true, false])('lets players optionally salvage before spinning (pay: %s)', (pay) => {
    const state = startAtSea();
    const before = state.players[0].gold;
    const salvage = controls().find((button) => button.props.children === 'Salvage · 100g')!;
    expect(salvage.props.disabled).toBe(false);
    if (pay) {
      (salvage.props.onClick as () => void)();
      const used = controls().find((button) => button.props.children === 'Salvaged')!;
      expect(used.props.disabled).toBe(true);
    }
    expect(state.phase).toBe('awaitingSpin');
    expect(state.currentPlayer).toBe(0);
    expect(state.players[0].gold).toBe(before + (pay ? 10 : 0));
    expect(state.log.some((line) => line.includes('Wreck salvage: paid 100g and recovered 110g.'))).toBe(pay);
    const spin = controls().find((button) => button.props.className === 'primary big')!;
    (spin.props.onClick as () => void)();
    expect(state.phase).toBe('spinning');
    expect(controls().some((button) => String(button.props.children).includes('Salvage'))).toBe(false);
  });

  it('disables salvage when the player cannot afford it', () => {
    const state = startAtSea();
    state.players[0].gold = 99;
    expect(controls().find((button) => button.props.children === 'Salvage · 100g')!.props.disabled).toBe(true);
  });

  it.each(['port', 'island', 'special'] as const)('explains why salvage is disabled at a %s start', (kind) => {
    const state = start();
    state.players[0].position = state.turnStartPosition = state.map.find((node) => node.kind === kind)!.id;
    const salvage = controls().find((button) => button.props.children === 'Salvage · Sea only')!;
    expect(salvage.props.disabled).toBe(true);
    expect(salvage.props.title).toBe('Your turn must start at sea to salvage.');
  });

  it('shows AI salvage before the AI spins', () => {
    const state = startAtSea(true);
    vi.advanceTimersByTime(700);
    expect(state.phase).toBe('spinning');
    expect(state.salvageUsed).toBe(true);
    expect(gameController.seaNotices[0].event.salvageFee).toBe(100);
  });

  it.each([true, false])('merchant accept=%s advances the turn and only accepted cargo is removed', (accept) => {
    const state = land('merchant');
    expect(state.phase).toBe('awaitingMerchant');
    const html = renderToStaticMarkup(panel());
    expect(html).toContain('Sell 3 Silk');
    expect(html).toContain('405g');
    const before = state.players[0].gold;
    click(accept ? 'Accept merchant offer' : 'Leave merchant ship');
    if (accept) {
      expect(state.phase).toBe('awaitingMerchant');
      click('Leave merchant ship');
    }
    expect(state.phase).toBe('awaitingSpin');
    expect(state.currentPlayer).toBe(1);
    expect(state.players[0].gold).toBe(before + (accept ? 405 : 0));
    expect(state.players[0].fleet[0].cargo.Silk).toBe(accept ? undefined : 3);
    expect(gameController.seaNotices.some((notice) => notice.event.outcome === (accept ? 'accepted' : 'declined'))).toBe(true);
  });

  it('buys a chosen quantity through the merchant window and keeps the visit open', () => {
    const state = land('merchant');
    const stock = state.pendingMerchant!.stock!;
    const before = state.players[0].gold;
    const input = elements(panel()).find((el) => el.type === 'input')!;
    (input.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '2' } });
    click('Buy cargo');
    expect(state.players[0].gold).toBe(before - 2 * stock.unitPrice);
    expect(stock.quantity).toBe(3);
    expect(state.phase).toBe('awaitingMerchant');
    click('Leave merchant ship');
    expect(state.currentPlayer).toBe(1);
  });

  it('shows merchant validation errors without closing the window', () => {
    const state = land('merchant');
    const input = elements(panel()).find((el) => el.type === 'input')!;
    (input.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '0' } });
    click('Buy cargo');
    expect(renderToStaticMarkup(panel())).toContain('Invalid merchant quantity');
    expect(state.phase).toBe('awaitingMerchant');
  });

  it('wyvern selection flies then resolves landing after the animation', () => {
    const state = land('wyvern');
    expect(state.phase).toBe('awaitingWyvern');
    const target = state.map.find((node) => node.kind === 'island')!;
    const select = elements(panel()).find((el) => el.type === 'select')!;
    (select.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: String(target.id) } });
    expect(renderToStaticMarkup(panel())).toContain('Fly with wyvern');
    click('Fly with wyvern');
    expect(state.phase).toBe('moving');
    expect(state.players[0].position).toBe(target.id);
    EventBus.emit('move-complete', moveId);
    expect(state.owners[target.id]).toBe(0);
    expect(state.phase).toBe('awaitingBuild');
    gameController.finishBuilding();
    expect(state.currentPlayer).toBe(1);
  });

  it('displays invalid destination errors without leaving the choice', () => {
    const state = land('wyvern');
    const select = elements(panel()).find((el) => el.type === 'select')!;
    (select.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '-1' } });
    click('Fly with wyvern');
    expect(renderToStaticMarkup(panel())).toContain('Unknown destination');
    expect(state.phase).toBe('awaitingWyvern');
  });

  it.each(['merchant', 'wyvern'] as const)('AI continues after %s without human input', (event) => {
    const state = land(event, true, false);
    vi.advanceTimersByTime(700);
    if (event === 'wyvern') {
      expect(state.phase).toBe('moving');
      EventBus.emit('move-complete', moveId);
      expect(state.phase).toBe('awaitingBuild');
    }
    expect(gameController.seaNotices.some((notice) => notice.event.outcome === (event === 'merchant' ? 'accepted' : 'relocated'))).toBe(true);
    vi.advanceTimersByTime(700);
    expect(state.currentPlayer).toBe(1);
  });
});
