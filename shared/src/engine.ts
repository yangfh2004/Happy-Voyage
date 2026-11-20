import { aiShouldClaim } from './ai';
import { rollDice, type Rng } from './dice';
import { createDefaultMap } from './map';
import { colonyValue, seatAtTurnOrderPosition, turnOrderPosition } from './rules';
import type { GameConfig, GameEvent, GameState, MapNode, Player, PlayerSetup } from './types';

export const DEFAULT_CONFIG: GameConfig = {
  startingGold: 1400,
  homeSalary: 400,
  islandsToWin: 10,
  maxRounds: 50,
};

export const EVENT_GOLD = {
  treasure: { min: 50, max: 200, step: 50 },
  storm: { min: 50, max: 100, step: 25 },
  tradeWind: { base: 50, perColony: 30 },
} as const;

export const SEA_RULES = {
  foreignTax: 40, tribute: 35, scrap: 60, ticket: 40, lotteryPrize: 300,
  lotteryChance: 0.25, nimStones: 12, nimPrize: 130, marketPerColony: 35,
  barterPerColony: 25, captainPrice: 45, pirates: 80, seaMonster: 110,
  whirlpoolLoss: 60, whirlpoolSteps: 4, bottle: 70, floatingCargo: 100, merchantPerColony: 40,
} as const;

export interface EngineOptions {
  players: PlayerSetup[];
  config?: Partial<GameConfig>;
  map?: MapNode[];
  rng?: Rng;
}

type Listener = (event: GameEvent, state: GameState) => void;

/**
 * The rules of the core loop, independent of any renderer:
 *
 *   awaitingRoll --roll()--> moving --resolveLanding()--> awaitingClaim --claim()/decline()-->
 *   (next player) awaitingRoll ... until gameOver
 *
 * `moving` exists so a renderer can animate the path before the landing is
 * applied. The same class can run on the server for multiplayer.
 */
export class GameEngine {
  readonly state: GameState;
  private readonly rng: Rng;
  private readonly listeners = new Set<Listener>();
  private relocations = 0;

  constructor(options: EngineOptions) {
    if (options.players.length < 1) throw new Error('At least one player is required');
    const config = { ...DEFAULT_CONFIG, ...options.config };
    const map = options.map ?? createDefaultMap();
    this.rng = options.rng ?? Math.random;
    this.state = {
      config,
      map,
      players: options.players.map((p, id) => ({
        ...p,
        id,
        gold: config.startingGold,
        position: map.filter((n) => n.kind === 'port')[id]?.id ?? 0,
        homePort: map.filter((n) => n.kind === 'port')[id]?.id ?? 0,
        revivalProtection: false,
        captain: false,
        bankrupt: false,
      })),
      owners: map.map(() => null),
      currentPlayer: 0,
      round: 1,
      phase: 'awaitingRoll',
      lastRoll: null,
      pendingClaim: null,
      winner: null,
      log: [],
    };
  }

  /** Subscribe to engine events; returns an unsubscribe function. */
  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get currentPlayer(): Player {
    return this.state.players[this.state.currentPlayer];
  }

  /** Start the first turn (separate from the constructor so listeners can attach first). */
  start(): void {
    this.log(`Round 1: ${this.currentPlayer.name} sets sail first.`);
    this.emit({ type: 'turnStarted', playerId: this.currentPlayer.id });
  }

  islandsOwnedBy(playerId: number): number {
    return this.state.owners.filter((o) => o === playerId).length;
  }

  /** Gold plus the end-of-voyage value of every colony. */
  netWorth(playerId: number): number {
    const colonies = this.state.map
      .filter((n) => this.state.owners[n.id] === playerId)
      .reduce((sum, n) => sum + colonyValue(n), 0);
    return this.state.players[playerId].gold + colonies;
  }

  /** Roll two dice and move the current fleet. Returns the nodes visited, in order. */
  roll(): number[] {
    this.assertPhase('awaitingRoll');
    this.relocations = 0;
    const player = this.currentPlayer;
    const dice = rollDice(this.rng);
    this.state.lastRoll = dice;
    this.emit({ type: 'diceRolled', playerId: player.id, dice });

    const steps = dice[0] + dice[1];
    const size = this.state.map.length;
    const path: number[] = [];
    for (let i = 1; i <= steps; i++) path.push((player.position + i) % size);

    // Each pass of (or landing on) the home port pays the royal salary.
    const homePasses = path.filter((id) => id === player.homePort).length;
    if (homePasses > 0) this.changeGold(player, this.state.config.homeSalary * homePasses, 'royal salary');

    player.position = path[path.length - 1];
    this.state.phase = 'moving';
    this.log(`${player.name} rolls ${dice[0]} + ${dice[1]} and sails to ${this.node(player.position).name}.`);
    this.emit({ type: 'moved', playerId: player.id, path });
    return path;
  }

  /** Apply the effect of the stop the current fleet landed on. Call after the move animation. */
  resolveLanding(): void {
    this.assertPhase('moving');
    const player = this.currentPlayer;
    const node = this.node(player.position);

    switch (node.kind) {
      case 'port':
        if (node.id !== player.homePort) {
          const host = this.state.players.find((p) => p.homePort === node.id && !p.bankrupt);
          const paid = Math.min(player.gold, SEA_RULES.foreignTax);
          this.log(`${player.name} pays ${SEA_RULES.foreignTax}g foreign tax to ${host?.name ?? 'the crown'} at ${node.name}.`);
          this.changeGold(player, -SEA_RULES.foreignTax, 'foreign tax');
          if (host) this.changeGold(host, paid, 'foreign tax');
        } else this.log(`${player.name} returns to their home port.`);
        break;
      case 'special':
        this.resolveSpecial(player, node);
        break;
      case 'event':
        if (this.resolveEvent(player, node)) return;
        break;
      case 'island': {
        const owner = this.state.owners[node.id];
        if (owner === null) {
          if (player.gold >= (node.price ?? Infinity)) {
            this.state.phase = 'awaitingClaim';
            this.state.pendingClaim = node.id;
            this.emit({ type: 'claimOffered', playerId: player.id, nodeId: node.id });
            return; // wait for claim() / decline()
          }
          this.log(`${player.name} cannot afford to settle ${node.name} (${node.price}g).`);
        } else if (owner !== player.id) {
          this.payToll(player, this.state.players[owner], node);
        } else {
          this.log(`${player.name} inspects the colony at ${node.name}.`);
        }
        break;
      }
    }
    this.endTurn();
  }

  /** Found a colony on the offered island. */
  claim(): void {
    this.assertPhase('awaitingClaim');
    const player = this.currentPlayer;
    const node = this.node(this.state.pendingClaim!);
    this.changeGold(player, -(node.price ?? 0), `colony at ${node.name}`);
    this.state.owners[node.id] = player.id;
    this.log(`${player.name} plants the flag on ${node.name}!`);
    this.emit({ type: 'claimed', playerId: player.id, nodeId: node.id });
    this.endTurn();
  }

  /** Sail on without claiming the offered island. */
  decline(): void {
    this.assertPhase('awaitingClaim');
    this.log(`${this.currentPlayer.name} sails past ${this.node(this.state.pendingClaim!).name}.`);
    this.endTurn();
  }

  /** Let the built-in AI make the current player's pending decision. */
  decideForAI(): void {
    if (this.state.phase === 'awaitingClaim') {
      const player = this.currentPlayer;
      if (aiShouldClaim(this.state, player, this.state.pendingClaim!)) this.claim();
      else this.decline();
    }
  }

  // --- internals -----------------------------------------------------------

  private resolveSpecial(player: Player, node: MapNode): void {
    const r = SEA_RULES;
    const colonies = this.islandsOwnedBy(player.id);
    this.log(`${player.name} visits ${node.name} (${node.chineseName ?? ''}).`);
    switch (node.special) {
      case 'skeleton':
        if (player.gold >= r.tribute) {
          this.log(`The pirates demand tribute from ${player.name} at their second-hand ship market.`);
          this.changeGold(player, -r.tribute, 'pirate tribute');
        } else {
          this.log(`The pirates buy ${player.name}'s scrap ship fittings.`);
          this.changeGold(player, r.scrap, 'scrap sale');
        }
        break;
      case 'treasure':
        if (player.gold < r.ticket) { this.log(`${player.name} cannot afford a lottery ticket.`); break; }
        this.changeGold(player, -r.ticket, 'lottery ticket');
        if (this.rng() < r.lotteryChance) {
          this.log(`${player.name}'s lottery ticket wins the grand prize!`);
          this.changeGold(player, r.lotteryPrize, 'lottery prize');
        } else this.log(`${player.name}'s lottery ticket wins no prize.`);
        break;
      case 'mist': {
        let stones: number = r.nimStones;
        let human = true;
        while (stones > 0) {
          const optimal = (stones - 1) % 4;
          const take = human ? 1 + Math.floor(this.rng() * Math.min(3, stones)) : (optimal || 1);
          stones -= take;
          if (stones <= 0) break;
          human = !human;
        }
        this.log(`${player.name} plays hermit Nim: take 1–3 stones, last loses. ${human ? 'The hermit wins.' : `${player.name} wins the prize!`}`);
        if (!human) this.changeGold(player, r.nimPrize, 'Nim prize');
        break;
      }
      case 'revival':
        player.revivalProtection = true;
        this.log(`${player.name} gets full repair! Revival protection blocks ${player.name}'s next sea hazard.`);
        break;
      case 'nightless':
        this.log(`The 24-hour market buys specialties from ${player.name}'s ${colonies} colonies.`);
        this.changeGold(player, colonies * r.marketPerColony, 'specialty market');
        break;
      case 'wind': {
        const multiplier = 1 + Math.floor(this.rng() * 3);
        this.log(`Native barter offers ${player.name} a ${multiplier}× exchange for ${colonies} colonies.`);
        this.changeGold(player, colonies * r.barterPerColony * multiplier, 'native barter');
        break;
      }
      case 'dragonSnake':
        if (player.gold < r.captainPrice) { this.log(`${player.name} cannot afford to recruit a captain.`); break; }
        this.changeGold(player, -r.captainPrice, 'captain recruitment');
        player.captain = true;
        this.log(`A captain joins ${player.name}: their next colony toll is halved.`);
        break;
    }
  }

  private resolveEvent(player: Player, node: MapNode): boolean {
    if (['storm', 'pirates', 'seaMonster', 'whirlpool', 'wyvern'].includes(node.event ?? '') && player.revivalProtection) {
      player.revivalProtection = false;
      this.log(`Revival protection shields ${player.name} from ${node.event}.`);
      return false;
    }
    switch (node.event) {
      case 'pirates':
      case 'seaMonster':
        this.log(`${node.event === 'pirates' ? 'Pirates raid' : 'A sea monster attacks'} ${player.name}'s fleet.`);
        this.changeGold(player, -SEA_RULES[node.event], node.event);
        break;
      case 'bottle':
      case 'floatingCargo':
        this.log(`${player.name} recovers ${node.event === 'bottle' ? 'a bottled reward chart' : 'floating cargo'}.`);
        this.changeGold(player, SEA_RULES[node.event], node.event);
        break;
      case 'merchant':
        this.log(`A merchant buys specialties from ${player.name}.`);
        this.changeGold(player, SEA_RULES.merchantPerColony * this.islandsOwnedBy(player.id), 'merchant');
        break;
      case 'whirlpool':
      case 'wyvern': {
        if (node.event === 'whirlpool' && this.rng() < 0.33) {
          this.log(`Bermuda whirlpool damages ${player.name}'s fleet.`);
          this.changeGold(player, -SEA_RULES.whirlpoolLoss, 'whirlpool');
          break;
        }
        const size = this.state.map.length;
        if (this.relocations++ >= 4) { this.log(`${player.name}'s fleet escapes the circling currents and rests.`); break; }
        let target = Math.floor(this.rng() * size);
        let path = [target];
        if (node.event === 'whirlpool') {
          const direction = this.rng() < 0.5 ? -1 : 1;
          path = Array.from({ length: SEA_RULES.whirlpoolSteps }, (_, i) => (player.position + direction * (i + 1) + size * SEA_RULES.whirlpoolSteps) % size);
          target = path[path.length - 1];
        }
        player.position = target;
        this.log(`${node.event === 'wyvern' ? 'A wyvern carries' : 'Bermuda currents push'} ${player.name}'s fleet to ${this.node(target).name}.`);
        const homePasses = path.filter((id) => id === player.homePort).length;
        if (homePasses) this.changeGold(player, this.state.config.homeSalary * homePasses, 'royal salary');
        this.emit({ type: 'moved', playerId: player.id, path });
        return true;
      }
      case 'treasure': {
        const { min, max, step } = EVENT_GOLD.treasure;
        const amount = min + Math.floor(this.rng() * ((max - min) / step + 1)) * step;
        this.log(`${player.name} hauls up a sunken chest worth ${amount}g!`);
        this.changeGold(player, amount, 'treasure');
        break;
      }
      case 'storm': {
        const { min, max, step } = EVENT_GOLD.storm;
        const amount = min + Math.floor(this.rng() * ((max - min) / step + 1)) * step;
        this.log(`A storm batters ${player.name}'s fleet: repairs cost ${amount}g.`);
        this.changeGold(player, -amount, 'storm repairs');
        break;
      }
      case 'tradeWind': {
        const amount = EVENT_GOLD.tradeWind.perColony * this.islandsOwnedBy(player.id) + EVENT_GOLD.tradeWind.base;
        this.log(`Trade winds carry ${player.name}'s goods to market: +${amount}g.`);
        this.changeGold(player, amount, 'trade');
        break;
      }
    }
    return false;
  }

  private payToll(player: Player, owner: Player, node: MapNode): void {
    const toll = player.captain ? Math.ceil((node.toll ?? 0) / 2) : node.toll ?? 0;
    if (player.captain) this.log(`${player.name}'s captain negotiates half the toll.`);
    player.captain = false;
    const amount = Math.min(toll, Math.max(player.gold, 0));
    this.changeGold(player, -toll, `toll at ${node.name}`);
    this.changeGold(owner, amount, `toll at ${node.name}`);
    this.log(`${player.name} pays ${toll}g toll to ${owner.name} at ${node.name}.`);
    this.emit({ type: 'tollPaid', from: player.id, to: owner.id, amount });
  }

  private changeGold(player: Player, delta: number, reason: string): void {
    player.gold += delta;
    this.emit({ type: 'goldChanged', playerId: player.id, delta, reason });
    if (player.gold < 0 && !player.bankrupt) {
      player.gold = 0;
      player.bankrupt = true;
      // A bankrupt navigator's colonies return to the wild.
      this.state.owners = this.state.owners.map((o) => (o === player.id ? null : o));
      this.log(`${player.name} is bankrupt! Their colonies fall back to neutral.`);
      this.emit({ type: 'bankrupt', playerId: player.id });
    }
  }

  private endTurn(): void {
    this.state.pendingClaim = null;
    if (this.checkVictory()) return;

    const lastPosition = turnOrderPosition(this.state, this.state.currentPlayer);
    let next = this.nextActivePlayer(lastPosition + 1);
    if (next === undefined) {
      this.state.round += 1;
      if (this.checkVictory()) return;
      this.log(`Round ${this.state.round} begins.`);
      next = this.nextActivePlayer(0)!;
    }

    this.state.currentPlayer = next;
    this.state.phase = 'awaitingRoll';
    this.emit({ type: 'turnStarted', playerId: next });
  }

  private nextActivePlayer(fromPosition: number): number | undefined {
    const { players } = this.state;
    for (let i = fromPosition; i < players.length; i++) {
      const seat = seatAtTurnOrderPosition(this.state, i);
      if (!players[seat].bankrupt) return seat;
    }
  }

  private checkVictory(): boolean {
    const { players, config } = this.state;
    const alive = players.filter((p) => !p.bankrupt);
    let winner: Player | undefined;
    let reason = '';

    const conqueror = alive.find((p) => this.islandsOwnedBy(p.id) >= config.islandsToWin);
    if (conqueror) {
      winner = conqueror;
      reason = `claimed ${config.islandsToWin} islands for the crown`;
    } else if (players.length > 1 && alive.length === 1) {
      winner = alive[0];
      reason = 'is the last navigator afloat';
    } else if (alive.length === 0) {
      winner = players[0];
      reason = 'outlasted the sea';
    } else if (this.state.round > config.maxRounds) {
      winner = alive.reduce((a, b) => (this.netWorth(b.id) > this.netWorth(a.id) ? b : a));
      reason = `is the richest navigator after ${config.maxRounds} rounds`;
    }

    if (!winner) return false;
    this.state.phase = 'gameOver';
    this.state.winner = winner.id;
    this.log(`${winner.name} ${reason}!`);
    this.emit({ type: 'gameOver', winner: winner.id, reason });
    return true;
  }

  private node(id: number): MapNode {
    return this.state.map[id];
  }

  private log(message: string): void {
    this.state.log.push(message);
    this.emit({ type: 'log', message });
  }

  private assertPhase(phase: GameState['phase']): void {
    if (this.state.phase !== phase) {
      throw new Error(`Expected phase ${phase}, but the game is in ${this.state.phase}`);
    }
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event, this.state);
  }
}
