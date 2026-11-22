import { isEliminated, walkPath, type GameState } from '@happy-voyage/shared';

export interface LandingTarget {
  nodeId: number;
  playerId: number;
  steps: number | null;
  preview: boolean;
}

export interface MovePath { playerId: number; path: number[]; sailFrom?: number }
export interface NavigatePreview { playerId: number; nodeId: number }

export function sailingRoute(state: GameState | null, move?: MovePath | null): number[] {
  if (!state?.map.length) return [];
  const player = state.players[state.currentPlayer];
  if (!player || isEliminated(player)) return [];
  if (state.phase === 'spinning' && state.lastSpin && Number.isInteger(state.lastSpin) && state.lastSpin > 0) {
    return [player.position, ...walkPath(state.map, player.position, state.lastSpin, state.wind.direction)];
  }
  if (state.phase !== 'moving' || move?.playerId !== player.id || move.sailFrom === undefined || !move.path.length) return [];
  const from = move.sailFrom;
  const expected = walkPath(state.map, from, move.path.length, state.wind.direction);
  return move.path.every((node, i) => node === expected[i]) ? [from, ...move.path] : [];
}

export function landingTarget(state: GameState | null, move?: MovePath | null, preview?: NavigatePreview | null): LandingTarget | null {
  if (!state || !state.map.length) return null;
  const player = state.players[state.currentPlayer];
  if (!player || isEliminated(player)) return null;
  if (state.phase === 'spinning') {
    const steps = state.lastSpin;
    if (steps === null || !Number.isInteger(steps) || steps <= 0) return null;
    const node = state.map[walkPath(state.map, player.position, steps, state.wind.direction).at(-1)!];
    return node ? { nodeId: node.id, playerId: player.id, steps, preview: false } : null;
  }
  if (state.phase === 'moving' && move?.playerId === player.id && move.path.length) {
    const nodeId = move.path.at(-1)!;
    return state.map.some((node) => node.id === nodeId) ? { nodeId, playerId: player.id, steps: move.path.length, preview: false } : null;
  }
  if (state.phase === 'awaitingSpin' && preview?.playerId === player.id && player.strategies.includes('navigate') && !state.strategyUsed && state.map.some((node) => node.id === preview.nodeId)) {
    return { nodeId: preview.nodeId, playerId: player.id, steps: null, preview: true };
  }
  return null;
}
