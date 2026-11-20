import { describe, expect, it, vi } from 'vitest';
vi.mock('../game/GameController', () => ({ gameController: {} }));
import { coachStage, landingCoachPlacement } from './TurnCoach';
import { readPreference, writePreference } from './accessibilityPreferences';

describe('first-turn coaching', () => {
  const map = { left: 10, right: 900, top: 136, bottom: 690 };
  it('keeps a top-row destination callout below the island and inside the map', () => {
    expect(landingCoachPlacement({ x: 750, y: 178 }, map)).toEqual({ left: 750, top: 226, below: true });
  });
  it('places lower destinations above the island and clamps at chart edges', () => {
    expect(landingCoachPlacement({ x: 895, y: 650 }, map)).toEqual({ left: 790, top: 540, below: false });
    expect(landingCoachPlacement({ x: -50, y: -10 }, map)).toEqual({ left: 120, top: 144, below: true });
  });
  it('points at Spin then the known target, never at an unknown destination', () => {
    expect(coachStage('awaitingSpin', true, false, false)).toBe('spin');
    expect(coachStage('spinning', true, false, true)).toBe('landing');
    expect(coachStage('moving', true, false, true)).toBe('landing');
    expect(coachStage('moving', true, false, false)).toBeNull();
    expect(coachStage('awaitingClaim', true, false, false)).toBeNull();
  });
  it('suppresses tips for AI, remote turns and dismissed coaching', () => {
    expect(coachStage('awaitingSpin', false, false, true)).toBeNull();
    expect(coachStage('spinning', true, true, true)).toBeNull();
  });
  it('keeps dismissal in session when browser storage is unavailable', () => {
    writePreference('coach-dismissed', true);
    expect(readPreference('coach-dismissed')).toBe(true);
    writePreference('coach-dismissed', false);
    expect(readPreference('coach-dismissed')).toBe(false);
  });
});
