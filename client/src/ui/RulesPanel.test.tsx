import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_CONFIG } from '@happy-voyage/shared';
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
