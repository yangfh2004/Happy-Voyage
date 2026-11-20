import { colonyValue, turnOrderPosition } from './rules';
import type { GameState, MapNode, Player } from './types';

const DICE_TOTALS = Array.from({ length: 11 }, (_, i) => ({
  steps: i + 2,
  odds: (6 - Math.abs(i - 5)) / 36,
}));

/** Forecast the next two rolls without privileged access to the dice. */
function bankruptcyOdds(state: GameState, player: Player, gold: number): number {
  const { map, owners, config } = state;
  const horizon = Math.min(2, config.maxRounds - state.round);
  const maxLoss = map.reduce((max, node) => {
    if (node.event === 'storm') return Math.max(max, 100);
    const owner = owners[node.id];
    return owner !== null && owner !== player.id ? Math.max(max, node.toll ?? 0) : max;
  }, 0);
  if (gold >= horizon * maxLoss) return 0;

  function forecast(position: number, cash: number, turns: number): number {
    if (cash < 0) return 1;
    if (turns === 0) return 0;
    return DICE_TOTALS.reduce((risk, { steps, odds }) => {
      const next = (position + steps) % map.length;
      const node = map[next];
      const afterSalary = cash + (position + steps >= map.length ? config.homeSalary : 0);
      const owner = owners[next];
      if (node.event === 'storm') {
        const stormRisk = [50, 75, 100].reduce(
          (sum, repair) => sum + forecast(next, afterSalary - repair, turns - 1),
          0,
        );
        return risk + odds * stormRisk / 3;
      }
      const toll = owner !== null && owner !== player.id ? (node.toll ?? 0) : 0;
      return risk + odds * forecast(next, afterSalary - toll, turns - 1);
    }, 0);
  }
  return forecast(player.position, gold, horizon);
}

function estimatedTolls(state: GameState, player: Player, node: MapNode): number {
  const myTurn = turnOrderPosition(state, player.id);
  let tolls = 0;
  for (const rival of state.players) {
    if (rival.bankrupt || rival.id === player.id) continue;
    const moves = state.config.maxRounds - state.round + Number(turnOrderPosition(state, rival.id) > myTurn);
    if (moves === 0) continue;
    const nextRollOdds = DICE_TOTALS.reduce((chance, { steps, odds }) =>
      chance + ((rival.position + steps) % state.map.length === node.id ? odds : 0), 0);
    tolls += Math.min(rival.gold, node.toll ?? 0) * (nextRollOdds + (moves - 1) / state.map.length);
  }
  return tolls;
}

export function aiShouldClaim(state: GameState, player: Player, nodeId: number): boolean {
  const node = state.map[nodeId];
  const price = node.price ?? Infinity;
  if (player.gold < price) return false;

  const owned = state.owners.filter((owner) => owner === player.id).length;
  const leftToWin = state.config.islandsToWin - owned;
  if (leftToWin <= 1) return true;

  const turnsLeft = state.config.maxRounds - state.round;
  const cash = player.gold - price;
  if (bankruptcyOdds(state, player, cash) > 0.12) return false;
  const neutralIslands = state.map.filter((stop) => stop.kind === 'island' && state.owners[stop.id] === null).length;
  if (turnsLeft + 1 >= leftToWin && neutralIslands >= leftToWin) return true;
  return estimatedTolls(state, player, node) >= price - colonyValue(node);
}
