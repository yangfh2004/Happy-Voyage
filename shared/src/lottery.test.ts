import { describe, expect, it } from 'vitest';
import { GameEngine } from './engine';
import { LOTTERY, drawLotteryBalls, expectedLotteryPrize, lotteryMatches, lotteryOdds } from './lottery';
import { aiLotteryPickCount, AI_LOTTERY_RESERVE } from './ai';

function game(rng = () => 0, isAI = false) {
  return new GameEngine({ players: [0, 1].map((i) => ({ name: `Captain ${i}`, color: i, isAI: isAI || i === 1 })), rng });
}
function land(g: GameEngine) {
  g.currentPlayer.position = g.state.map.find((node) => node.special === 'treasure')!.id;
  g.state.phase = 'moving';
  g.resolveLanding();
}

describe('Treasure Island lottery', () => {
  it('draws five distinct balls from the jar', () => {
    let seed = 7;
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 50; i++) {
      const balls = drawLotteryBalls(rng);
      expect(balls).toHaveLength(LOTTERY.drawn);
      expect(new Set(balls).size).toBe(LOTTERY.drawn);
      expect(balls.every((n) => Number.isInteger(n) && n >= 1 && n <= LOTTERY.balls)).toBe(true);
    }
    // rng 0 always takes the lowest ball left in the jar.
    expect(drawLotteryBalls(() => 0)).toEqual([1, 2, 3, 4, 5]);
    expect(lotteryMatches([9, 4, 1], [1, 2, 3, 4, 5])).toEqual([1, 4]);
  });

  it('publishes exact match odds for each ticket size', () => {
    for (let picks = 0; picks <= LOTTERY.maxPicks; picks++) {
      expect(lotteryOdds(picks).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    }
    expect(lotteryOdds(1)[1]).toBeCloseTo(LOTTERY.drawn / LOTTERY.balls, 10);
    expect(lotteryOdds(5)[5]).toBeCloseTo(1 / 15504, 10);
    expect(expectedLotteryPrize(0)).toBe(0);
    expect(expectedLotteryPrize(1)).toBeLessThan(LOTTERY.ticketPrice);
  });

  it('opens on landing, sells numbers before the timer runs out, then draws and records the result', () => {
    const g = game();
    const p = g.currentPlayer;
    land(g);
    expect(g.state.phase).toBe('awaitingLottery');
    expect(g.state.currentPlayer).toBe(0);
    expect(g.state.lottery).toMatchObject({ playerId: 0, picks: [], secondsLeft: LOTTERY.timerSeconds, draw: null });

    g.buyLotteryNumber(4);
    g.buyLotteryNumber(2);
    g.buyLotteryNumber(17);
    expect(g.state.lottery!.picks).toEqual([2, 4, 17]);
    expect(p.gold).toBe(g.state.config.startingGold - 3 * LOTTERY.ticketPrice);
    expect(() => g.buyLotteryNumber(4)).toThrow('Cannot buy');
    expect(() => g.buyLotteryNumber(0)).toThrow('Cannot buy');
    expect(() => g.buyLotteryNumber(LOTTERY.balls + 1)).toThrow('Cannot buy');
    expect(() => g.finishLottery()).toThrow('not drawn');

    expect(g.advanceLotteryClock(LOTTERY.timerSeconds - 1)).toBe(1);
    expect(g.state.lottery!.draw).toBeNull();
    expect(g.advanceLotteryClock(5)).toBe(0);

    const draw = g.state.lottery!.draw!;
    expect(draw).toEqual({ round: 1, playerId: 0, nodeId: p.position, picks: [2, 4, 17], balls: [1, 2, 3, 4, 5], matches: [2, 4], spent: 120, prize: LOTTERY.payouts[2] });
    expect(g.state.lotteryDraws).toEqual([draw]);
    expect(p.gold).toBe(g.state.config.startingGold - 120 + LOTTERY.payouts[2]);
    expect(() => g.buyLotteryNumber(9)).toThrow('Cannot buy');
    expect(() => g.drawLottery()).toThrow('already drawn');
    expect(g.state.log.at(-1)).toContain('2 matches, winning 240g');

    g.finishLottery();
    expect(g.state.lottery).toBeNull();
    expect(g.state.currentPlayer).toBe(1);
    expect(g.state.phase).toBe('awaitingSpin');
    expect(g.state.lotteryDraws).toHaveLength(1);
  });

  it('draws even when no numbers were bought, and caps purchases', () => {
    const g = game();
    land(g);
    g.advanceLotteryClock(LOTTERY.timerSeconds);
    expect(g.state.lottery!.draw).toMatchObject({ picks: [], matches: [], spent: 0, prize: 0 });

    const h = game();
    land(h);
    for (let n = 1; n <= LOTTERY.maxPicks; n++) h.buyLotteryNumber(n + 10);
    expect(h.canBuyLotteryNumber(1)).toBe(false);
    h.currentPlayer.gold = LOTTERY.ticketPrice - 1;
    expect(h.canBuyLotteryNumber(1)).toBe(false);
  });

  it('skips the lottery when the navigator cannot afford a number', () => {
    const g = game();
    g.currentPlayer.gold = LOTTERY.ticketPrice - 1;
    land(g);
    expect(g.state.lottery).toBeNull();
    expect(g.state.phase).toBe('awaitingSpin');
    expect(g.state.currentPlayer).toBe(1);
  });

  it('lets the AI buy within its reserve, draw and sail on in one decision', () => {
    expect(aiLotteryPickCount(AI_LOTTERY_RESERVE)).toBe(0);
    expect(aiLotteryPickCount(AI_LOTTERY_RESERVE + LOTTERY.ticketPrice)).toBe(1);
    expect(aiLotteryPickCount(100_000)).toBe(3);
    const g = game(() => 0, true);
    land(g);
    g.decideForAI();
    expect(g.state.lotteryDraws).toHaveLength(1);
    expect(g.state.lotteryDraws[0].picks).toHaveLength(3);
    expect(g.state.currentPlayer).toBe(1);
    expect(g.state.phase).toBe('awaitingSpin');
  });
});
