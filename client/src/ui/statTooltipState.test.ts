import { describe, expect, it } from 'vitest';
import { statTooltipState } from './statTooltipState';

const start = { left: 1240, top: 840, above: false };
const afterScroll = { left: 1240, top: 600, above: false };

describe('stat tooltip interactions', () => {
  it('repositions an engaged tooltip on scroll without dismissing it', () => {
    const focused = statTooltipState(null, { type: 'engage', position: start });
    const scrolled = statTooltipState(focused, { type: 'reposition', position: afterScroll });
    expect(scrolled?.position).toEqual(afterScroll);
    expect(statTooltipState(scrolled, { type: 'leave', pointerType: 'mouse' })).toBe(scrolled);
    expect(statTooltipState(scrolled, { type: 'dismiss' })).toBeNull();
  });

  it('keeps a tapped tooltip open through touch and compatibility mouse leave', () => {
    const tapped = statTooltipState(null, { type: 'engage', position: start });
    expect(statTooltipState(tapped, { type: 'leave', pointerType: 'touch' })).toBe(tapped);
    expect(statTooltipState(tapped, { type: 'leave', pointerType: 'mouse' })).toBe(tapped);
    expect(statTooltipState(tapped, { type: 'dismiss' })).toBeNull();
  });

  it('still dismisses mouse-only hover on mouse leave and never reopens on scroll', () => {
    const hover = statTooltipState(null, { type: 'hover', position: start });
    expect(statTooltipState(hover, { type: 'leave', pointerType: 'touch' })).toBe(hover);
    const dismissed = statTooltipState(hover, { type: 'leave', pointerType: 'mouse' });
    expect(dismissed).toBeNull();
    expect(statTooltipState(dismissed, { type: 'reposition', position: afterScroll })).toBeNull();
  });
});
