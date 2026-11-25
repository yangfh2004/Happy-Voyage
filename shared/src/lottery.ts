import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { Rng } from './compass';

/** Treasure Island (金银岛) lottery: buy numbers before the timer runs out, then balls are drawn from the jar. */
export const LOTTERY = {
  get balls() { return GAMEPLAY_TUNING.lottery.balls; },
  get drawn() { return GAMEPLAY_TUNING.lottery.drawn; },
  get maxPicks() { return GAMEPLAY_TUNING.lottery.maxPicks; },
  get ticketPrice() { return GAMEPLAY_TUNING.lottery.ticketPrice; },
  get timerSeconds() { return GAMEPLAY_TUNING.lottery.timerSeconds; },
  get payouts() { return Object.values(GAMEPLAY_TUNING.lottery.payouts); },
};

/** One recorded Treasure Island draw. */
export interface LotteryDraw {
  round: number;
  playerId: number;
  nodeId: number;
  picks: number[];
  /** Balls in the order they left the jar. */
  balls: number[];
  matches: number[];
  spent: number;
  prize: number;
}

/** A lottery in progress at Treasure Island; `draw` is set once the balls are drawn. */
export interface LotteryState {
  playerId: number;
  nodeId: number;
  picks: number[];
  secondsLeft: number;
  draw: LotteryDraw | null;
}

export function drawLotteryBalls(rng: Rng): number[] {
  const jar = Array.from({ length: LOTTERY.balls }, (_, i) => i + 1);
  const balls: number[] = [];
  while (balls.length < LOTTERY.drawn) balls.push(jar.splice(Math.floor(rng() * jar.length), 1)[0]);
  return balls;
}

export function lotteryMatches(picks: number[], balls: number[]): number[] {
  return picks.filter((n) => balls.includes(n)).sort((a, b) => a - b);
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = result * (n - k + i) / i;
  return result;
}

/** Chance of each match count (index = matches) when holding `picks` numbers. */
export function lotteryOdds(picks: number): number[] {
  const { balls, drawn } = LOTTERY;
  return LOTTERY.payouts.map((_, matches) => choose(drawn, matches) * choose(balls - drawn, picks - matches) / choose(balls, picks));
}

export function expectedLotteryPrize(picks: number): number {
  return lotteryOdds(picks).reduce((sum, chance, matches) => sum + chance * LOTTERY.payouts[matches], 0);
}
