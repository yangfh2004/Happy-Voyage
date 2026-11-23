import { createBattle, issueCommand, stepBattle, type BattleCommand, type BattleControllers, type BattleLog, type BattleSide, type Formation, type GameState, type PendingBattle } from '@happy-voyage/shared';

export class BattleSession {
  readonly battle;
  readonly log: BattleLog = [];
  readonly controllers: BattleControllers = {};
  readonly side: BattleSide;

  constructor(pending: PendingBattle, players: GameState['players']) {
    this.battle = createBattle(pending.setup);
    this.side = pending.commanders[0];
    if (!pending.commanders.includes('attacker')) this.controllers.attacker = players[pending.attacker].aiDifficulty ?? 'normal';
    if (!pending.commanders.includes('defender')) this.controllers.defender = pending.defender === null ? 'normal' : players[pending.defender].aiDifficulty ?? 'normal';
  }

  command(cmd: BattleCommand): void {
    if (this.battle.outcome) return;
    const copy: BattleCommand = JSON.parse(JSON.stringify(cmd));
    this.log.push({ tick: this.battle.tick, side: this.side, cmd: copy });
    issueCommand(this.battle, this.side, copy);
  }

  step(): void {
    stepBattle(this.battle, this.controllers);
  }

  changeFormation(shipIds: number[], formation: Formation): void {
    const ships = this.battle.ships.filter(s => s.side === this.side && !s.sunk && !s.escaped && shipIds.includes(s.id));
    if (ships.length < 2) return;
    const group = this.battle.groups.find(g => g.side === this.side && g.shipIds.length === ships.length && ships.every(s => s.groupId === g.id));
    const current = group?.order ?? { type: 'free' as const };
    const order = current.type === 'attack' && !this.battle.ships.some(s => s.side !== this.side && s.id === current.targetId && !s.sunk && !s.escaped) ? { type: 'free' as const } : current;
    this.command({ ...order, shipIds: ships.map(s => s.id), formation });
  }
}
