import { createBattle, issueCommand, stepBattle, type BattleCommand, type BattleControllers, type BattleLog, type BattleSide, type GameState, type PendingBattle } from '@happy-voyage/shared';

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
}
