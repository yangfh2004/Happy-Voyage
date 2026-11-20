import { gameController, SPEEDS, type GameSpeed } from '../game/GameController';
import { useT } from '../i18n';

const SPEED_ZH: Record<GameSpeed, string> = { Normal: '正常', Fast: '快速', Instant: '瞬间' };

export function SpeedControl() {
  const { t, locale } = useT();
  return (
    <div className="choices speed" role="group" aria-label={t('Game speed', '游戏速度')}>
      <span>{t('Speed', '速度')}</span>
      {(Object.keys(SPEEDS) as GameSpeed[]).map((speed, i) => (
        <button
          key={speed}
          className={gameController.speed === speed ? 'chip selected' : 'chip'}
          aria-pressed={gameController.speed === speed}
          onClick={() => gameController.setSpeed(speed)}
        >
          {locale === 'zh' ? SPEED_ZH[speed] : speed} <kbd>{i + 1}</kbd>
        </button>
      ))}
    </div>
  );
}
