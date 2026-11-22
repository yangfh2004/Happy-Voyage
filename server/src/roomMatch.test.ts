import { afterEach, describe, expect, it, vi } from 'vitest';
import { ONLINE_PACING, sailingStepDuration, type RoomPick } from '@happy-voyage/shared';
import { RoomMatch } from './roomMatch';

afterEach(() => vi.useRealTimers());

it('only accepts a Revival acknowledgement from the player at the helm', () => {
  const seats: RoomPick[] = [{ name: 'Captain', nation: 'Spain' }, { name: 'Rival', nation: 'Portugal' }];
  const publish = vi.fn();
  const match = new RoomMatch(seats, { mode: 'conquest', difficulty: 'normal' }, publish, vi.fn());
  const { currentPlayer, state } = match.engine;
  currentPlayer.position = state.map.find((node) => node.special === 'revival')!.id;
  state.phase = 'moving';
  match.engine.resolveLanding();
  expect(state.phase).toBe('awaitingRevival');
  const rival = state.players.find((player) => player.id !== currentPlayer.id && !player.isAI)!;
  expect(() => match.act(rival.id, match.revision, ['leaveRevivalIsland'])).toThrow('not your turn');
  match.act(currentPlayer.id, match.revision, ['leaveRevivalIsland']);
  expect(publish).toHaveBeenCalledOnce();
  expect(state.revivalReport).toBeNull();
  expect(state.phase).toBe('awaitingSpin');
  match.dispose();
});

describe('online sailing budget', () => {
  it.each([false, true])('waits for the full Normal and Fast sailing animation before landing, AI=%s', isAI => {
    vi.useFakeTimers();
    const seats: RoomPick[] = [{ name: 'Captain', nation: 'Spain' }, { name: 'Rival', nation: 'Portugal' }];
    const publish = vi.fn();
    const onError = vi.fn();
    const match = new RoomMatch(seats, { mode: 'conquest', difficulty: 'normal' }, publish, onError, { rng: () => 0 });
    match.engine.currentPlayer.isAI = isAI;
    match.engine.currentPlayer.strategies = [];
    match.start();
    if (isAI) vi.advanceTimersByTime(ONLINE_PACING.rival.decision);
    else match.act(match.engine.currentPlayer.id, match.revision, ['spinCompass']);
    const pace = isAI ? ONLINE_PACING.rival : ONLINE_PACING.human;
    vi.advanceTimersByTime(pace.spin);
    expect(match.engine.state.phase).toBe('moving');
    const steps = match.engine.state.lastSpin!;
    const normal = sailingStepDuration(Math.min(200, pace.step), isAI) * steps;
    const fast = sailingStepDuration(Math.min(70, pace.step), isAI) * steps;
    expect(normal).toBeGreaterThanOrEqual(fast);
    vi.advanceTimersByTime(Math.ceil(normal));
    expect(match.engine.state.phase).toBe('moving');
    vi.advanceTimersByTime(100);
    expect(match.engine.state.phase).not.toBe('moving');
    expect(onError).not.toHaveBeenCalled();
    match.dispose();
  });
});
