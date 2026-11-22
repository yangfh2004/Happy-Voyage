import { expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { GameEngine } from '@happy-voyage/shared';

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock('react', async (load) => ({
  ...await load<typeof import('react')>(),
  useEffect: () => {},
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => { hooks.values[index] = value; }];
  },
}));
vi.mock('../i18n', () => ({ useT: () => ({ locale: 'en', l: () => '', t: (en: string, _zh: string, params: Record<string, unknown> = {}) => en.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key])) }) }));
vi.mock('../game/GameController', () => ({ gameController: {
  spinId: 0, feedback: {}, headline: null, timings: { spin: 0 },
  canUseStrategy: vi.fn(), useStrategy: vi.fn(),
} }));
vi.mock('dialog-polyfill', () => ({ default: { registerDialog: vi.fn() } }));
vi.mock('../game/EventBus', () => ({ EventBus: { emit: vi.fn() } }));
import { gameController } from '../game/GameController';
import { ActionPanel } from './ActionPanel';

function elements(node: ReactNode): { type: unknown; props: Record<string, any> }[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, any>>(node)) return [];
  return [node, ...elements(node.props.children)];
}

it('sends selected rival and colony ids, not the Navigate destination', () => {
  const g = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'One', color: 1, isAI: true }, { name: 'Two', color: 2, isAI: true }], config: { startingStrategies: 0 } });
  g.currentPlayer.strategies = ['plunder', 'scorch'];
  const colonies = g.state.map.filter((n) => n.kind === 'island').slice(0, 2);
  colonies.forEach((n) => { g.state.owners[n.id] = 1; });
  vi.mocked(gameController.canUseStrategy).mockImplementation((id, target) => g.canUseStrategy(id, target));
  const render = () => { hooks.cursor = 0; return elements(ActionPanel({ state: g.state })); };
  hooks.values = [];
  let tree = render();
  let selects = tree.filter((e) => e.type === 'select');
  expect(selects).toHaveLength(2);
  selects[0].props.onChange({ target: { value: '2' } });
  tree = render();
  tree.find((e) => e.type === 'button' && e.props.children === 'Use Plunder')!.props.onClick();
  expect(gameController.useStrategy).toHaveBeenCalledWith('plunder', 2);
  selects = tree.filter((e) => e.type === 'select');
  selects[1].props.onChange({ target: { value: String(colonies[1].id) } });
  tree = render();
  tree.find((e) => e.type === 'button' && e.props.children === 'Use Burn Stores')!.props.onClick();
  expect(gameController.useStrategy).toHaveBeenCalledWith('scorch', colonies[1].id);
  g.state.owners[colonies[1].id] = null;
  tree = render();
  expect(tree.filter((e) => e.type === 'select')[1].props.value).toBe(colonies[0].id);
});
