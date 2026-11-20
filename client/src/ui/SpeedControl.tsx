import { gameController, SPEEDS, type GameSpeed } from '../game/GameController';

export function SpeedControl() {
  return (
    <div className="choices speed" role="group" aria-label="Game speed">
      <span>Speed</span>
      {(Object.keys(SPEEDS) as GameSpeed[]).map((speed) => (
        <button
          key={speed}
          className={gameController.speed === speed ? 'chip selected' : 'chip'}
          aria-pressed={gameController.speed === speed}
          onClick={() => gameController.setSpeed(speed)}
        >
          {speed}
        </button>
      ))}
    </div>
  );
}
