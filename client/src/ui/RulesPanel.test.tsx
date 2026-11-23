import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_CONFIG } from '@happy-voyage/shared';
import { setLocale } from '../i18n';
import { RulesPanel } from './RulesPanel';

describe('repair rules', () => {
  it('explains free occupation, paid Revival repairs, docked maintenance, and damage', () => {
    const html = renderToStaticMarkup(<RulesPanel config={DEFAULT_CONFIG} onClose={() => {}} />);
    expect(html).toContain('automatically claims it for free');
    expect(html).toContain('Revival automatically repairs your fleet at 2g per durability point, limited by your gold, with no other bonus');
    expect(html).not.toContain('blocks the next sea hazard');
    expect(html).not.toMatch(/\p{Script=Han}/u);
    expect(html).toContain('Fully repair all ships docked');
    expect(html).toContain("owner&#x27;s turn start");
    expect(html).toContain('10 durability per ship');
  });
});

describe('fleet capacity rules', () => {
  it.each(['en', 'zh'] as const)('explains recruitment and tax overflow in %s', (locale) => {
    setLocale(locale);
    try {
      const html = renderToStaticMarkup(<RulesPanel config={DEFAULT_CONFIG} onClose={() => {}} />);
      if (locale === 'en') {
        expect(html).toContain('Their ships fill open slots in your 10-ship fleet; any extras go to a shipyard at one of your colonies.');
        expect(html).toContain('Seized ships fill open slots in the host’s 10-ship fleet; any extras go to a shipyard at one of the host’s colonies.');
        expect(html).not.toMatch(/\p{Script=Han}/u);
      } else {
        expect(html).toContain('这些船先填补航行舰队的空位（最多 10 艘），多出的船留在己方殖民地船坞。');
        expect(html).toContain('被扣押的船先填补东道主航行舰队的空位（最多 10 艘），多出的船送往东道主的殖民地船坞。');
      }
    } finally {
      setLocale('en');
    }
  });
});
