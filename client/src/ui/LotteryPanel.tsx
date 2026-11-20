import type { CSSProperties } from 'react';
import { LOTTERY, lotteryOdds, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';

const NUMBERS = Array.from({ length: LOTTERY.balls }, (_, i) => i + 1);
const percent = (chance: number) => `${chance >= 0.01 ? Math.round(chance * 100) : (chance * 100).toFixed(2)}%`;

/** Treasure Island (金银岛): pick numbers before the timer runs out, then watch the balls leave the glass jar. */
export function LotteryPanel({ state }: { state: GameState }) {
  const lottery = state.lottery;
  if (!lottery) return null;
  const player = state.players[state.currentPlayer];
  const { draw } = lottery;
  const odds = lotteryOdds(Math.max(1, lottery.picks.length));
  const ballDelay = gameController.lotteryBallDelay;

  return <section aria-labelledby="lottery-title" className="lottery">
    <h2 id="lottery-title">Treasure Island lottery · 金银岛</h2>
    {!draw ? <>
      <p>
        Buy up to {LOTTERY.maxPicks} numbers at {LOTTERY.ticketPrice}g each. When the timer runs out, {LOTTERY.drawn} of
        the {LOTTERY.balls} balls are drawn from the glass jar.
      </p>
      <p className="lottery-timer" role="timer" aria-live="off">
        Draw in <strong>{lottery.secondsLeft}s</strong> · Treasury {player.gold}g · {lottery.picks.length}/{LOTTERY.maxPicks} numbers
      </p>
      <div className="lottery-grid" role="group" aria-label="Lottery numbers">
        {NUMBERS.map((n) => {
          const picked = lottery.picks.includes(n);
          return <button key={n} className={picked ? 'ball picked' : 'ball'} aria-pressed={picked}
            disabled={picked || !gameController.canBuyLotteryNumber(n)} onClick={() => gameController.buyLotteryNumber(n)}>{n}</button>;
        })}
      </div>
      <table className="lottery-payouts">
        <caption>Prizes · odds with {Math.max(1, lottery.picks.length)} number{lottery.picks.length > 1 ? 's' : ''}</caption>
        <tbody>{LOTTERY.payouts.slice(1).map((prize, i) => <tr key={i}>
          <th>{i + 1} match{i ? 'es' : ''}</th><td>{prize}g</td><td>{percent(odds[i + 1])}</td>
        </tr>)}</tbody>
      </table>
      <button className="primary" onClick={() => gameController.drawLottery()}>Draw now <kbd>D</kbd></button>
    </> : <>
      <div className="lottery-jar" aria-label={`Balls drawn: ${draw.balls.join(', ')}`}>
        {draw.balls.map((n, i) => <span key={n} className={draw.matches.includes(n) ? 'ball drawn match' : 'ball drawn'}
          style={{ '--delay': `${i * ballDelay}ms` } as CSSProperties}>{n}</span>)}
      </div>
      {!gameController.lotteryRevealed ? <p className="lottery-result" aria-live="polite">Drawing from the jar…</p> : <>
      <p>Your numbers: {draw.picks.length ? draw.picks.map((n) => <span key={n} className={draw.matches.includes(n) ? 'ball small match' : 'ball small'}>{n}</span>) : 'none'}</p>
      <p className="lottery-result">
        {draw.matches.length} match{draw.matches.length === 1 ? '' : 'es'} · spent {draw.spent}g · {draw.prize ? <strong>won {draw.prize}g!</strong> : 'no prize'}
      </p>
      <button className="primary" onClick={() => gameController.finishLottery()}>Sail on <kbd>D</kbd></button>
      </>}
    </>}
  </section>;
}
