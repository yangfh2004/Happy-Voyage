import { describe, expect, it } from 'vitest';
import { SPIN_COMPASS_LABEL, STAT_HELP, TUTORIAL_STEPS, chartIdentity } from './accessibility';
import { localize } from './i18n';
import { NATIONS } from './nations';

describe('accessibility copy', () => {
  it.each(['en', 'zh'] as const)('uses the compass button label in the %s tutorial heading and instructions', (locale) => {
    const { title, text } = TUTORIAL_STEPS[0];
    const label = localize(locale, SPIN_COMPASS_LABEL);
    expect(localize(locale, title)).toBe(label);
    expect(localize(locale, text)).toContain(label);
  });

  it('localizes every tutorial step and stat explanation', () => {
    const copy = [
      ...TUTORIAL_STEPS.flatMap(({ title, text }) => [title, text]),
      ...Object.values(STAT_HELP).flatMap(({ label, description }) => [label, description]),
    ];
    for (const entry of copy) {
      expect(localize('en', entry)).toMatch(/[A-Za-z]/);
      expect(localize('zh', entry)).toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it('describes free occupation and immediate development in the tutorial and distinguishes colony value from a fee', () => {
    const { text } = TUTORIAL_STEPS[1];
    expect(localize('en', text)).toContain('claims it for free. After claiming or capturing a colony');
    expect(localize('zh', text)).toContain('占领或夺取殖民地后，可以立即修建设施');
    expect(localize('en', STAT_HELP.price.description)).toContain('not a fee');
    expect(localize('zh', STAT_HELP.price.description)).toContain('不是占领费用');
  });
});

describe('chart identity', () => {
  it('keeps the original player colors and does not add markers by default', () => {
    expect(chartIdentity({ id: 0, color: 0x123456 }, false)).toEqual({ color: 0x123456, badge: null });
  });

  it('assigns every seat a different palette color and a non-color identifier', () => {
    const entries = NATIONS.map(({ color }, id) => chartIdentity({ id, color }, true));
    expect(new Set(entries.map(({ color }) => color)).size).toBe(NATIONS.length);
    expect(entries.map(({ badge }) => badge)).toEqual(NATIONS.map((_, id) => String(id + 1)));
    expect(chartIdentity({ id: 2, color: 0 }, true)).toEqual(entries[2]);
  });
});
