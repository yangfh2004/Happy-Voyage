import type { CSSProperties } from 'react';
import { LOTTERY, lotteryOdds, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { useT } from '../i18n';

const NUMBERS = Array.from({ length: LOTTERY.balls }, (_, i) => i + 1);
const percent = (chance: number) => `${chance >= 0.01 ? Math.round(chance * 100) : (chance * 100).toFixed(2)}%`;

/** Treasure Island (金银岛): pick numbers before the timer runs out, then watch the balls leave the glass jar. */
export function LotteryPanel({ state }: { state: GameState }) {
  const lottery = state.lottery;
  const { t } = useT();
  if (!lottery) return null;
  const player = state.players[state.currentPlayer];
  const { draw } = lottery;
  const odds = lotteryOdds(Math.max(1, lottery.picks.length));
  const ballDelay = gameController.lotteryBallDelay;

  return <section aria-labelledby="lottery-title" className="lottery">
    <h2 id="lottery-title">{t('Treasure Island lottery', '金银岛彩票')}</h2>
    {!draw ? <>
      <p>
        {t('Buy up to {m} numbers at {p}g each. When the timer runs out, {d} of the {b} balls are drawn from the glass jar.',
          '以每个 {p} 金币购买最多 {m} 个号码。倒计时结束时，会从玻璃罐的 {b} 个球中抽出 {d} 个。',
          { m: LOTTERY.maxPicks, p: LOTTERY.ticketPrice, d: LOTTERY.drawn, b: LOTTERY.balls })}
      </p>
      <p className="lottery-timer" role="timer" aria-live="off">
        {t('Draw in', '开奖倒计时')} <strong>{lottery.secondsLeft}{t('s', ' 秒')}</strong> · {t('Treasury {g}g · {n}/{m} numbers', '金库 {g} 金币 · 号码 {n}/{m}', { g: player.gold, n: lottery.picks.length, m: LOTTERY.maxPicks })}
      </p>
      <div className="lottery-grid" role="group" aria-label={t('Lottery numbers', '彩票号码')}>
        {NUMBERS.map((n) => {
          const picked = lottery.picks.includes(n);
          return <button key={n} className={picked ? 'ball picked' : 'ball'} aria-pressed={picked}
            disabled={picked || !gameController.canBuyLotteryNumber(n)} onClick={() => gameController.buyLotteryNumber(n)}>{n}</button>;
        })}
      </div>
      <table className="lottery-payouts">
        <caption>{t(`Prizes · odds with {n} number${lottery.picks.length > 1 ? 's' : ''}`, '奖金 · 持有 {n} 个号码时的概率', { n: Math.max(1, lottery.picks.length) })}</caption>
        <tbody>{LOTTERY.payouts.slice(1).map((prize, i) => <tr key={i}>
          <th>{t(`{n} match${i ? 'es' : ''}`, '中 {n} 个', { n: i + 1 })}</th><td>{prize}{t('g', ' 金币')}</td><td>{percent(odds[i + 1])}</td>
        </tr>)}</tbody>
      </table>
      <button className="primary" onClick={() => gameController.drawLottery()}>{t('Draw now', '立即开奖')} <kbd>D</kbd></button>
    </> : <>
      <div className="lottery-jar" aria-label={t('Balls drawn: {b}', '抽出的球：{b}', { b: draw.balls.join(', ') })}>
        {draw.balls.map((n, i) => <span key={n} className={draw.matches.includes(n) ? 'ball drawn match' : 'ball drawn'}
          style={{ '--delay': `${i * ballDelay}ms` } as CSSProperties}
          onAnimationEnd={i === draw.balls.length - 1 ? () => gameController.lotteryBallsLanded() : undefined}>{n}</span>)}
      </div>
      {!gameController.lotteryRevealed ? <p className="lottery-result" aria-live="polite">{t('Drawing from the jar…', '正在从罐中抽球……')}</p> : <>
      <p>{t('Your numbers:', '你的号码：')} {draw.picks.length ? draw.picks.map((n) => <span key={n} className={draw.matches.includes(n) ? 'ball small match' : 'ball small'}>{n}</span>) : t('none', '无')}</p>
      <p className="lottery-result">
        {t(`{n} match${draw.matches.length === 1 ? '' : 'es'} · spent {s}g`, '中 {n} 个 · 花费 {s} 金币', { n: draw.matches.length, s: draw.spent })} · {draw.prize ? <strong>{t('won {g}g!', '赢得 {g} 金币！', { g: draw.prize })}</strong> : t('no prize', '未中奖')}
      </p>
      <button className="primary" onClick={() => gameController.finishLottery()}>{t('Sail on', '继续航行')} <kbd>D</kbd></button>
      </>}
    </>}
  </section>;
}
