import { buildingLevel, buildingValue, nextBuildingCost } from './buildings';
import { colonyDefenders } from './combat';
import { LOTTERY } from './lottery';
import { NIM_MAX_TAKE } from './mist';
import { colonyValue, isEliminated } from './rules';
import { cargoLoad, SHIP_RECIPES, USED_SHIP_PRICES } from './ships';
import { STRATEGIES, type StrategyId } from './strategies';
import type { BuildingKind, GameState, Player, ShipType } from './types';

/** Read-only rules queries for both the engine and clients displaying a server snapshot. */
export class GameView {
  constructor(readonly state: GameState, private readonly hoardExists?: boolean) {}

  get currentPlayer(): Player {
    return this.state.players[this.state.currentPlayer];
  }

  canUseStrategy(id: StrategyId, target?: number): boolean {
    const card = STRATEGIES[id];
    if (!card || this.state.strategyUsed || isEliminated(this.currentPlayer) || !this.currentPlayer.strategies.includes(id) || !card.phases.includes(this.state.phase)) return false;
    if (id === 'navigate') return Number.isInteger(target) && this.state.map.some((n) => n.id === target);
    if (id === 'locate') return this.hoardExists ?? (this.state.hoardNode !== null);
    const owner = this.state.owners[this.currentPlayer.position];
    if (owner === null || owner === undefined || owner === this.currentPlayer.id) return false;
    if (id === 'inspire') return this.currentPlayer.fleet.length > 0;
    const defenders = colonyDefenders(this.state, this.currentPlayer.position);
    return defenders.ships.length > (defenders.fromFleet ? 1 : 0);
  }

  islandsOwnedBy(playerId: number): number {
    return this.state.owners.filter((o) => o === playerId).length;
  }

  netWorth(playerId: number): number {
    const colonies = this.state.map
      .filter((n) => this.state.owners[n.id] === playerId)
      .reduce((sum, n) => sum + colonyValue(n) + buildingValue(this.state, n.id), 0);
    return this.state.players[playerId].gold + colonies;
  }

  canBuyLotteryNumber(number: number): boolean {
    const lottery = this.state.lottery;
    return this.state.phase === 'awaitingLottery' && !!lottery && !lottery.draw && lottery.secondsLeft > 0 &&
      Number.isInteger(number) && number >= 1 && number <= LOTTERY.balls && !lottery.picks.includes(number) &&
      lottery.picks.length < LOTTERY.maxPicks && this.currentPlayer.gold >= LOTTERY.ticketPrice;
  }

  canTakeMistStones(count: number): boolean {
    const duel = this.state.mistDuel;
    return this.state.phase === 'awaitingMistDuel' && !!duel?.hermitId && !duel.result &&
      Number.isInteger(count) && count >= 1 && count <= Math.min(NIM_MAX_TAKE, duel.stonesLeft);
  }

  canLeaveMistIsland(): boolean {
    const duel = this.state.mistDuel;
    return this.state.phase === 'awaitingMistDuel' && !!duel && (duel.hermitId === null || duel.result !== null);
  }

  canBuild(kind: BuildingKind): boolean {
    const player = this.currentPlayer;
    const node = this.state.map[player.position];
    const cost = nextBuildingCost(this.state, player.position, kind);
    return this.state.phase === 'awaitingBuild' && node?.kind === 'island' &&
      this.state.owners[player.position] === player.id && cost !== null && player.gold >= cost;
  }

  canBuildShip(type: ShipType): boolean {
    const player = this.currentPlayer;
    const nodeId = player.position;
    if (this.state.phase !== 'awaitingBuild' || this.state.map[nodeId]?.kind !== 'island' ||
      this.state.owners[nodeId] !== player.id || !Object.hasOwn(SHIP_RECIPES, type)) return false;

    const recipe = SHIP_RECIPES[type];
    const stock = this.state.stockpiles[nodeId];
    return buildingLevel(this.state, nodeId, 'shipyard') >= recipe.yardLevel &&
      stock.lumber >= recipe.lumber && stock.iron >= recipe.iron;
  }

  protected atMarket(): boolean {
    return this.state.phase === 'awaitingMarket' && !isEliminated(this.currentPlayer) &&
      this.state.map[this.currentPlayer.position]?.special === 'skeleton';
  }

  canBuyUsedShip(type: ShipType): boolean {
    return this.atMarket() && this.state.marketStock.includes(type) && this.currentPlayer.gold >= USED_SHIP_PRICES[type];
  }

  canSellShip(shipId: number): boolean {
    return this.atMarket() && this.currentPlayer.fleet.length > 1 &&
      this.currentPlayer.fleet.some((ship) => ship.id === shipId && cargoLoad(ship) === 0);
  }
}
