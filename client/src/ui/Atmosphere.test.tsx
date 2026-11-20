import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNationRoster, GameEngine } from '@happy-voyage/shared';
import { setLocale } from '../i18n';
import { Atmosphere } from './Atmosphere';

afterEach(() => setLocale('en'));

describe('atmosphere HUD localization', () => {
  it('does not show a pill without a voyage', () => {
    expect(renderToStaticMarkup(<Atmosphere state={null} />)).toBe('');
  });
  it.each([
    [1, false, 'Dawn', 'Clear', '黎明', '晴朗'],
    [2, false, 'Day', 'Clouds', '白天', '多云'],
    [3, false, 'Dusk', 'Rain', '黄昏', '降雨'],
    [4, true, 'Night', 'Storm', '夜晚', '风暴'],
    [5, false, 'Dawn', 'Fog', '黎明', '雾'],
  ] as const)('translates round %s phase and weather on language changes', (round, storm, phaseEn, weatherEn, phaseZh, weatherZh) => {
    const { state } = new GameEngine({ players: createNationRoster([{ name: 'Me', nation: 'Spain' }]) });
    state.round = round;
    state.market.repairDemandThroughRound = storm ? round : 0;
    for (const locale of ['en', 'zh', 'en'] as const) {
      setLocale(locale);
      const html = renderToStaticMarkup(<Atmosphere state={state} />);
      expect(html).toContain(`${locale === 'zh' ? phaseZh : phaseEn} · ${locale === 'zh' ? weatherZh : weatherEn}`);
      expect(html).toContain('role="status"');
    }
  });
});
