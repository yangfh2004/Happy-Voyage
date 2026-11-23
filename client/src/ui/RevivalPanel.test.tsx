import { GameEngine } from '@happy-voyage/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { RevivalPanel } from './RevivalPanel';

vi.mock('../game/GameController', () => ({ gameController: { leaveRevivalIsland: vi.fn() } }));

afterEach(() => setLocale('en'));

it.each(['en', 'zh'] as const)('shows settled partial Revival results in %s', (locale) => {
  setLocale(locale);
  const engine = new GameEngine({ players: [{ name: 'Human', color: 0, isAI: false }] });
  const { state, currentPlayer } = engine;
  currentPlayer.fleet[0].durability -= 4;
  currentPlayer.gold = 2;
  currentPlayer.position = state.map.find((node) => node.special === 'revival')!.id;
  state.phase = 'moving';
  engine.resolveLanding();
  const html = renderToStaticMarkup(<RevivalPanel state={state} />);
  expect(html).toContain('<meter');
  expect(html).not.toContain(locale === 'en' ? 'Protected' : '庇护');
  expect(html).toContain(locale === 'en' ? '1 of 4' : '1 / 4');
  expect(html).toContain(locale === 'en' ? '2g' : '2 金币');
  expect(html).toContain(locale === 'en' ? 'Unrepaired damage: 3' : '剩余损伤：3');
  expect(html).toContain(locale === 'en' ? 'Sail on' : '继续航行');
  if (locale === 'en') expect(html).not.toMatch(/\p{Script=Han}/u);
});

it.each([0, 4])('shows a settled affordable repair for %i damage', (damage) => {
  const engine = new GameEngine({ players: [{ name: 'Human', color: 0, isAI: false }] });
  engine.currentPlayer.fleet[0].durability -= damage;
  engine.currentPlayer.position = engine.state.map.find((node) => node.special === 'revival')!.id;
  engine.state.phase = 'moving';
  engine.resolveLanding();
  const html = renderToStaticMarkup(<RevivalPanel state={engine.state} />);
  expect(html).toContain(`${damage} of ${damage}`);
  expect(html).toContain(`${damage * 2}g`);
  expect(html).not.toContain('Not enough gold');
});
