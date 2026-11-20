import type { GameEvent, GameState } from '@happy-voyage/shared';

export interface TurnSummary {
  tolls: { direction: 'received' | 'paid'; name: string; amount: number }[];
  claims: { name: string; island: string; captured?: boolean }[];
  netGold: number;
}

export class TurnFeedback {
  summary: TurnSummary | null = null;
  readonly logTones = new Map<number, 'income' | 'expense'>();
  private baseline: number | null = null;
  private tolls: TurnSummary['tolls'] = [];
  private claims: TurnSummary['claims'] = [];

  observe(event: GameEvent, state: GameState): void {
    const human = state.players.find((player) => !player.isAI);
    if (!human) return;
    if (event.type === 'tollPaid' && (event.from === human.id || event.to === human.id)) {
      const received = event.to === human.id;
      if (this.baseline !== null) this.tolls.push({
        direction: received ? 'received' : 'paid',
        name: state.players[received ? event.from : event.to].name,
        amount: event.amount,
      });
      this.logTones.set(state.log.length - 1, received ? 'income' : 'expense');
    }
    if (event.type === 'claimed' && state.players[event.playerId].isAI && this.baseline !== null) {
      this.claims.push({ name: state.players[event.playerId].name, island: state.map[event.nodeId].name });
    }
    if (event.type === 'battleFought' && event.report.defender === human.id && event.report.outcome === 'victory') {
      const island = state.map[event.report.nodeId].name;
      const claim = this.claims.find((entry) => entry.island === island && !entry.captured);
      if (claim) claim.captured = true;
    }
    if (event.type === 'turnStarted' && event.playerId === human.id) {
      const netGold = this.baseline === null ? 0 : human.gold - this.baseline;
      this.summary = this.baseline !== null && (this.tolls.length || this.claims.length || netGold !== 0)
        ? { tolls: this.tolls, claims: this.claims, netGold } : null;
      this.baseline = null;
      this.tolls = [];
      this.claims = [];
    }
    if (event.type === 'turnStarted' && state.players[event.playerId].isAI && this.baseline === null) {
      this.baseline = human.gold;
    }
  }
}
