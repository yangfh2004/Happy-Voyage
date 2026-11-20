import { describe, expect, it, vi } from 'vitest';
vi.mock('../game/GameController', () => ({ gameController: {} }));
import { coachStage } from './TurnCoach';
import { readPreference, writePreference } from './accessibilityPreferences';

describe('first-turn coaching', () => {
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
