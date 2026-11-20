import { describe, expect, it } from 'vitest';
import { GameEngine } from '@happy-voyage/shared';
import { landingTarget } from './landingTarget';

const game = () => new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }] });

describe('landing target', () => {
  it('predicts a compass landing as soon as spinning starts, including route wrap', () => {
    const { state } = game();
    state.phase = 'spinning';
    state.players[0].position = state.map.length - 2;
    state.lastSpin = 5;
    expect(landingTarget(state)).toEqual({ nodeId: state.map[3].id, playerId: 0, steps: 5, preview: false });
    expect(state.players[0].position).toBe(state.map.length - 2);
  });
  it('uses the actual movement path, not an already-updated ship position or stale compass result', () => {
    const { state } = game();
    state.phase = 'moving';
    state.players[0].position = 8;
    state.lastSpin = 12;
    expect(landingTarget(state, { playerId: 0, path: [7, 8] })).toEqual({ nodeId: 8, playerId: 0, steps: 2, preview: false });
    expect(landingTarget(state, null)).toBeNull();
    state.phase = 'awaitingClaim';
    expect(landingTarget(state, { playerId: 0, path: [7, 8] })).toBeNull();
  });
  it('also predicts AI spins and ignores stale movement for a different player', () => {
    const { state } = game();
    state.currentPlayer = 1;
    state.phase = 'spinning';
    state.lastSpin = 2;
    const nodeId = (state.players[1].position + 2) % state.map.length;
    expect(landingTarget(state)?.nodeId).toBe(nodeId);
    expect(landingTarget(state)?.playerId).toBe(1);
    state.phase = 'moving';
    expect(landingTarget(state, { playerId: 0, path: [2] })).toBeNull();
  });
  it('previews Navigate without changing distance rules or surviving a spin/landing', () => {
    const { state } = game();
    state.players[0].strategies = ['navigate'];
    const preview = { playerId: 0, nodeId: 4 };
    expect(landingTarget(state, null, preview)).toEqual({ ...preview, steps: null, preview: true });
    expect(landingTarget(state, null, { ...preview, nodeId: 5 })?.nodeId).toBe(5);
    expect(landingTarget(state, null, { ...preview, playerId: 1 })).toBeNull();
    state.phase = 'spinning';
    state.lastSpin = 2;
    expect(landingTarget(state, null, preview)?.preview).toBe(false);
    state.phase = 'awaitingClaim';
    expect(landingTarget(state, null, preview)).toBeNull();
    state.phase = 'awaitingSpin';
    state.strategyUsed = true;
    expect(landingTarget(state, null, preview)).toBeNull();
  });
  it('rejects missing, empty and invalid targets', () => {
    const { state } = game();
    expect(landingTarget(null)).toBeNull();
    state.phase = 'spinning';
    for (const value of [null, 0, -1, NaN, 1.5]) {
      state.lastSpin = value;
      expect(landingTarget(state)).toBeNull();
    }
    state.phase = 'moving';
    expect(landingTarget(state, { playerId: 0, path: [] })).toBeNull();
    expect(landingTarget(state, { playerId: 0, path: [-1] })).toBeNull();
    state.phase = 'awaitingSpin';
    state.players[0].strategies = ['navigate'];
    expect(landingTarget(state, null, { playerId: 0, nodeId: -1 })).toBeNull();
    state.map = [];
    expect(landingTarget(state)).toBeNull();
  });
});
