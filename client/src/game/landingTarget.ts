import type { GameState } from '@happy-voyage/shared';

export interface LandingTarget {
  nodeId: number;
  playerId: number;
  steps: number | null;
  preview: boolean;
}

export interface MovePath { playerId: number; path: number[] }
export interface NavigatePreview { playerId: number; nodeId: number }

export function landingTarget(state: GameState | null, move?: MovePath | null, preview?: NavigatePreview | null): LandingTarget | null {
  if (!state || !state.map.length) return null;
  const player = state.players[state.currentPlayer];
  if (!player || player.bankrupt) return null;
  if (state.phase === 'spinning') {
    const steps = state.lastSpin;
    if (steps === null || !Number.isInteger(steps) || steps <= 0) return null;
    const node = state.map[(player.position + steps) % state.map.length];
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
