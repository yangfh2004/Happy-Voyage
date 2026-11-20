import type { GameEvent, GameState } from '@happy-voyage/shared';

export interface TurnSummary {
  tolls: { direction: 'received' | 'paid'; name: string; amount: number }[];
  claims: { name: string; island: string; captured?: boolean }[];
  netGold: number;
}

interface Watch {
  baseline: number | null;
  tolls: TurnSummary['tolls'];
  claims: TurnSummary['claims'];
}

/** Tracks what happened to each human seat while others were at the helm. */
export class TurnFeedback {
  /** Summary for the human whose turn started most recently. */
  summary: TurnSummary | null = null;
  readonly logTones = new Map<number, 'income' | 'expense'>();
  private readonly watches = new Map<number, Watch>();

  observe(event: GameEvent, state: GameState): void {
    const humans = state.players.filter((player) => !player.isAI);
    if (!humans.length) return;
    const isHuman = (id: number) => !state.players[id].isAI;
    if (event.type === 'tollPaid' && (isHuman(event.from) || isHuman(event.to))) {
      this.logTones.set(state.log.length - 1, isHuman(event.from) ? 'expense' : 'income');
    }
    for (const human of humans) {
      const watch = this.watches.get(human.id) ?? { baseline: null, tolls: [], claims: [] };
      this.watches.set(human.id, watch);
      if (event.type === 'tollPaid' && watch.baseline !== null && (event.from === human.id || event.to === human.id)) {
        const received = event.to === human.id;
        watch.tolls.push({ direction: received ? 'received' : 'paid', name: state.players[received ? event.from : event.to].name, amount: event.amount });
      }
      if (event.type === 'claimed' && event.playerId !== human.id && watch.baseline !== null) {
        watch.claims.push({ name: state.players[event.playerId].name, island: state.map[event.nodeId].name });
      }
      if (event.type === 'battleFought' && event.report.defender === human.id && event.report.outcome === 'victory') {
        const island = state.map[event.report.nodeId].name;
        const claim = watch.claims.find((entry) => entry.island === island && !entry.captured);
        if (claim) claim.captured = true;
      }
      if (event.type === 'turnStarted' && event.playerId === human.id) {
        const netGold = watch.baseline === null ? 0 : human.gold - watch.baseline;
        this.summary = watch.baseline !== null && (watch.tolls.length || watch.claims.length || netGold !== 0)
          ? { tolls: watch.tolls, claims: watch.claims, netGold } : null;
        this.watches.set(human.id, { baseline: null, tolls: [], claims: [] });
      } else if (event.type === 'turnStarted' && watch.baseline === null) {
        watch.baseline = human.gold;
      }
    }
  }
}
