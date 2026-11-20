import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const hooks = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => { hooks.values[index] = value; }];
  },
}));
vi.mock('../game/GameController', () => ({ gameController: { newGame: vi.fn(), newCampaign: vi.fn() } }));
vi.mock('./SpeedControl', () => ({ SpeedControl: () => null }));
vi.mock('./SoundControl', () => ({ SoundControl: () => null }));
vi.mock('./LanguageSwitch', () => ({ LanguageSwitch: () => null }));
import { SetupMenu } from './SetupMenu';
import { gameController } from '../game/GameController';

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap((child) => isValidElement<Record<string, unknown>>(child)
    ? [child, ...elements(child.props.children as ReactNode)] : []);
}
function screen() {
  hooks.index = 0;
  return SetupMenu({ onRules: () => {} });
}
function button(label: string) {
  return elements(screen()).find((el) => el.type === 'button' && (el.props['aria-label'] === label || el.props.children === label))!;
}
function click(label: string) {
  const el = button(label);
  expect(el.props.disabled).not.toBe(true);
  (el.props.onClick as () => void)();
}
beforeEach(() => { hooks.values = []; hooks.index = 0; vi.clearAllMocks(); });

describe('total-player setup', () => {
  it('defaults to four and passes the count and difficulty to the roster', () => {
    expect(renderToStaticMarkup(screen())).toContain('1 humans + 3 AI rivals');
    click('Set sail');
    expect(vi.mocked(gameController.newGame).mock.calls[0][0]).toHaveLength(4);
  });
  it('bounds totals to 2–10 and humans to the smaller of six and total', () => {
    for (let i = 0; i < 6; i++) click('Increase total players');
    expect(button('Increase total players').props.disabled).toBe(true);
    for (let i = 0; i < 5; i++) click('Add player');
    expect(button('Add player').props.disabled).toBe(true);
    for (let i = 0; i < 8; i++) click('Decrease total players');
    expect(button('Decrease total players').props.disabled).toBe(true);
    expect(button('Add player').props.disabled).toBe(true);
    expect(renderToStaticMarkup(screen())).toContain('2 humans + 0 AI rivals');
    click('Set sail');
    const roster = vi.mocked(gameController.newGame).mock.calls[0][0]!;
    expect(roster).toHaveLength(2);
    expect(roster.every((p) => !p.isAI)).toBe(true);
  });
  it('leaves campaign setup independent of the local player counts', () => {
    click('Decrease total players');
    click('Campaign');
    expect(elements(screen()).some((el) => el.props['aria-label'] === 'Total players')).toBe(false);
    click('Set sail');
    expect(gameController.newGame).not.toHaveBeenCalled();
    expect(gameController.newCampaign).toHaveBeenCalledWith(expect.objectContaining({ stage: 'first-voyage' }));
  });
});
