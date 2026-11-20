import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameEngine, LOTTERY } from '@happy-voyage/shared';
import { LotteryPanel } from './LotteryPanel';

vi.mock('../game/GameController', () => ({ gameController: {
  lotteryBallDelay: 0, lotteryRevealed: true, canBuyLotteryNumber: vi.fn((n: number) => n !== 20),
  buyLotteryNumber: vi.fn(), drawLottery: vi.fn(), finishLottery: vi.fn(),
} }));

function treasureGame() {
  const g = new GameEngine({ players: [{ name: 'You', color: 0, isAI: false }, { name: 'AI', color: 1, isAI: true }], rng: () => 0 });
  g.currentPlayer.position = g.state.map.find((node) => node.special === 'treasure')!.id;
  g.state.phase = 'moving';
  g.resolveLanding();
  return g;
}

describe('LotteryPanel', () => {
  it('shows the timer, number picker and prize odds while numbers are on sale', () => {
    const g = treasureGame();
    g.buyLotteryNumber(3);
    const html = renderToStaticMarkup(<LotteryPanel state={g.state} />);
    expect(html).toContain(`Draw in <strong>${LOTTERY.timerSeconds}s</strong>`);
    expect(html).toContain(`1/${LOTTERY.maxPicks} numbers`);
    expect(html).toContain('aria-pressed="true"');
    expect(html.match(/class="ball/g)).toHaveLength(LOTTERY.balls);
    expect(html).toContain('25%');
    expect(html).toContain('Draw now');
  });

  it('shows the drawn balls from the jar, matches and the prize', () => {
    const g = treasureGame();
    g.buyLotteryNumber(2);
    g.buyLotteryNumber(9);
    g.drawLottery();
    const html = renderToStaticMarkup(<LotteryPanel state={g.state} />);
    expect(html).toContain('Balls drawn: 1, 2, 3, 4, 5');
    expect(html.match(/ball drawn/g)).toHaveLength(LOTTERY.drawn);
    expect(html).toContain('ball drawn match');
    expect(html).toContain(`1 match · spent ${2 * LOTTERY.ticketPrice}g · <strong>won ${LOTTERY.payouts[1]}g!</strong>`);
    expect(html).toContain('Sail on');
    expect(html).not.toContain('Draw now');
  });
});
