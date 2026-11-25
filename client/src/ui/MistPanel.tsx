import { GAMEPLAY_TUNING } from '@happy-voyage/shared';
import { HERMITS, SEA_RULES, hermitText, strategyText, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { useT } from '../i18n';

export function MistPanel({ state }: { state: GameState }) {
  const duel = state.mistDuel;
  const { t, locale } = useT();
  const stoneCount = (count: number) => locale === 'zh' ? `${count} 枚棋子` : `${count} stone${count === 1 ? '' : 's'}`;
  const sname = (id: Parameters<typeof strategyText>[0]) => strategyText(id, locale).name;
  if (!duel) return null;
  const { stonesLeft, lastTurn, result } = duel;
  const hermit = HERMITS.find(({ id }) => id === duel.hermitId);

  return <section aria-labelledby="mist-title" className="mist">
    <h2 id="mist-title">{t('Mist Island duel', '迷雾岛对决')}</h2>
    <p>{t('Take 1–{m} stones in a row from the end. Whoever takes the last stone loses.', '每次从末端连续拿 1–{m} 枚棋子。拿到最后一枚者输。', { m: GAMEPLAY_TUNING.sea.nimMaxTake })}</p>
    {!hermit ? <>
      <p>{t('Choose a hermit to challenge. Win to learn their strategy.', '选择一位隐士挑战。获胜即可学到他的谋略。')}</p>
      <div className="mist-choices mist-hermits" role="group" aria-label={t('Choose a hermit', '选择隐士')}>
        {HERMITS.map(({ id, reward }) => (
          <button key={id} onClick={() => gameController.challengeHermit(id)}>
            <strong>{hermitText(id, locale).name}</strong>
            <small>{hermitText(id, locale).style}</small>
            <small>{t('teaches {s}', '传授「{s}」', { s: sname(reward) })}</small>
          </button>
        ))}
      </div>
      <button onClick={() => gameController.leaveMistIsland()}>{t('Sail on', '继续航行')}</button>
    </> : <>
      <div className="mist-duel-board">
        <h3>{hermitText(hermit.id, locale).name}</h3>
        <div className="mist-stones" aria-hidden="true">
          {Array.from({ length: SEA_RULES.nimStones }, (_, i) => (
            <span key={i} className={i < stonesLeft ? 'mist-stone' : 'mist-stone taken'} />
          ))}
        </div>
      </div>
      <div role="status">
        {lastTurn && <p>{t('You took {n}.', '你拿了 {n}。', { n: stoneCount(lastTurn.playerTake) })}{lastTurn.hermitTake !== null &&
          t(' {h} took {n}.', '{h} 拿了 {n}。', { h: hermitText(hermit.id, locale).name, n: stoneCount(lastTurn.hermitTake) })}</p>}
        {result ? result.outcome === 'win' ? <>
          <p><strong>{t('You win!', '你赢了！')}</strong> {t('{h} took the last stone.', '{h} 拿到了最后一枚棋子。', { h: hermitText(hermit.id, locale).name })}</p>
          <p>{t('Won {g}g.', '赢得 {g} 金币。', { g: SEA_RULES.nimPrize })} {result.strategy
            ? t('Strategy learned: {s}.', '学会谋略：{s}。', { s: sname(result.strategy) })
            : t('Your hand is full; {s} was discarded.', '你的手牌已满，「{s}」被弃置。', { s: sname(hermit.reward) })}</p>
        </> : <p><strong>{t('You lose.', '你输了。')}</strong> {t('You took the last stone.', '你拿到了最后一枚棋子。')}</p>
          : <p><strong>{t('{n} left', '剩余 {n}', { n: stoneCount(stonesLeft) })}</strong> · {t('Your move', '轮到你')}</p>}
      </div>
      {result ? <button className="primary" onClick={() => gameController.leaveMistIsland()}>{t('Sail on', '继续航行')}</button>
        : <div className="mist-choices mist-moves" role="group" aria-label={t('Take stones', '拿取棋子')}>
          {Array.from({ length: GAMEPLAY_TUNING.sea.nimMaxTake }, (_, i) => i + 1).map((count) => (
            <button key={count} className="primary" disabled={count > stonesLeft} onClick={() => gameController.takeMistStones(count)}>
              {t('Take {n}', '拿 {n}', { n: stoneCount(count) })}
            </button>
          ))}
        </div>}
    </>}
  </section>;
}
