import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNationRoster, GameEngine } from '@happy-voyage/shared';
import { setLocale } from '../i18n';
import { RouteDetails } from './RouteDetails';

vi.mock('../game/GameController', () => ({ gameController: { shownPosition: (player: { position: number }) => player.position } }));

afterEach(() => setLocale('en'));

describe('route details language', () => {
  it.each(['en', 'zh'] as const)('uses only the selected language for map names in %s', locale => {
    setLocale(locale);
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Captain', nation: 'Spain' }]) });
    const html = renderToStaticMarkup(<RouteDetails state={state} />);
    if (locale === 'en') {
      expect(html).not.toMatch(/[\u3400-\u9fff]/);
      expect(html).toContain('Skeleton Island');
      expect(html).toContain('Special island');
    } else {
      expect(html).toContain('骷髅岛');
      expect(html).not.toContain('Skeleton Island');
    }
  });

  it('renders an empty chart', () => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Captain', nation: 'Spain' }]) });
    expect(renderToStaticMarkup(<RouteDetails state={{ ...state, map: [] }} />)).not.toContain('<li');
  });
});
