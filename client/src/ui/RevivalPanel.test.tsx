import { GameEngine } from '@happy-voyage/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';
import { RevivalPanel } from './RevivalPanel';

vi.mock('../game/GameController', () => ({ gameController: { leaveRevivalIsland: vi.fn() } }));

afterEach(() => setLocale('en'));

it.each(['en', 'zh'] as const)('shows settled Revival results in %s', (locale) => {
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
  expect(html).toContain(locale === 'en' ? 'Protected from your next sea hazard.' : '庇护将抵挡你遭遇的下一次海上灾难。');
  expect(html).toContain(locale === 'en' ? '1 of 4' : '1 / 4');
  expect(html).toContain(locale === 'en' ? '2g' : '2 金币');
  expect(html).toContain(locale === 'en' ? 'Sail on' : '继续航行');
  if (locale === 'en') expect(html).not.toMatch(/\p{Script=Han}/u);
});
