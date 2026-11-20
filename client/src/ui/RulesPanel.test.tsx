import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_CONFIG } from '@happy-voyage/shared';
import { RulesPanel } from './RulesPanel';

describe('repair rules', () => {
  it('explains fees, partial repairs, docked maintenance, and damage', () => {
    const html = renderToStaticMarkup(<RulesPanel config={DEFAULT_CONFIG} onClose={() => {}} />);
    expect(html).toContain('2g per missing durability point');
    expect(html).toContain('partial repairs in fleet order');
    expect(html).toContain('a sound fleet is free');
    expect(html).toContain('Fully repair all ships docked');
    expect(html).toContain("owner&#x27;s turn start");
    expect(html).toContain('10 durability per ship');
  });
});
