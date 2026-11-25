import { describe, expect, it } from 'vitest';
import { GameEngine } from '@happy-voyage/shared';
import { landingTarget, sailingRoute } from './landingTarget';

const game = () => new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'Rival', color: 1, isAI: true }] });

describe('landing target', () => {
  it('draws only verified compass routes, never backward currents or Wyvern flights', () => {
    const { state } = game();
    expect(sailingRoute(null)).toEqual([]);
    state.phase = 'spinning';
    state.players[0].position = state.map.length - 1;
    state.lastSpin = 2;
    expect(sailingRoute(state)).toEqual([state.map.length - 1, 0, 1]);
    state.phase = 'moving';
    expect(sailingRoute(state, { playerId: 0, path: [0, 1], sailFrom: state.map.length - 1 })).toEqual([state.map.length - 1, 0, 1]);
    expect(sailingRoute(state, { playerId: 0, path: [5, 4, 3] })).toEqual([]);
    expect(sailingRoute(state, { playerId: 0, path: [5, 4, 3], sailFrom: 6 })).toEqual([]);
    expect(sailingRoute(state, { playerId: 0, path: [50] })).toEqual([]);
    expect(sailingRoute(state, { playerId: 0, path: [1] })).toEqual([]);
    expect(sailingRoute(state, { playerId: 0, path: [], sailFrom: 0 })).toEqual([]);
  });
  it('predicts a compass landing as soon as spinning starts, including route wrap', () => {
    const { state } = game();
    state.phase = 'spinning';
    state.players[0].position = state.map.length - 2;
    state.wind.direction = 'W';
    state.lastSpin = 5;
    expect(landingTarget(state)).toEqual({ nodeId: state.map[3].id, playerId: 0, steps: 5, preview: false });
    expect(state.players[0].position).toBe(state.map.length - 2);
  });
  it('previews and verifies the same wind-selected fork as the engine', () => {
    const engine = game();
    const { state } = engine;
    const netherlands = state.map.find(node => node.kind === 'port' && node.nation === 'Netherlands')!.id;
    state.players[0].position = 1;
    state.wind.direction = 'E';
    engine.spinCompass();
    state.lastSpin = 2;
    expect(sailingRoute(state)).toEqual([1, 2, netherlands]);
    expect(landingTarget(state)?.nodeId).toBe(netherlands);
    const path = engine.sail();
    expect(path).toEqual([2, netherlands]);
    expect(sailingRoute(state, { playerId: 0, path, sailFrom: 1 })).toEqual([1, 2, netherlands]);
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
    for (const value of [null, 0, NaN, 1.5]) {
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
  it('previews and verifies Reverse Course and doubled compass routes', () => {
    for (const card of ['reverse', 'tailwind'] as const) {
      const engine = game();
      const { state } = engine;
      const from = engine.currentPlayer.position;
      engine.currentPlayer.strategies = [card];
      engine.useStrategy(card);
      engine.spinCompass();
      const target = landingTarget(state)!;
      const route = sailingRoute(state);
      const path = engine.sail();
      expect(target.nodeId).toBe(path.at(-1));
      expect(route).toEqual([from, ...path]);
      expect(sailingRoute(state, { playerId: 0, path, sailFrom: from })).toEqual(route);
    }
  });
});
