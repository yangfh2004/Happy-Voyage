import { useState } from 'react';
import { DEFAULT_CONFIG, type PlayerSetup } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { NATIONS, cssColor } from './nations';

/** Start screen: pick a name, a nation and how many AI rivals to face. */
export function SetupMenu({ onRules }: { onRules: () => void }) {
  const [name, setName] = useState('Captain');
  const [nation, setNation] = useState(0);
  const [rivals, setRivals] = useState(2);

  const start = () => {
    const others = NATIONS.filter((_, i) => i !== nation).slice(0, rivals);
    const players: PlayerSetup[] = [
      { name: name.trim() || 'Captain', color: NATIONS[nation].color, isAI: false },
      ...others.map((n) => ({ name: n.name, color: n.color, isAI: true })),
    ];
    gameController.newGame(players);
  };

  return (
    <div className="panel setup">
      <h1>Happy Voyage</h1>
      <p className="subtitle">Seven Seas Domination · 欢乐大航海</p>
      <p>
        Roll the dice, sail the route and plant your flag on new lands. Rivals pay you a toll when they
        land on your colonies. Claim {DEFAULT_CONFIG.islandsToWin} islands, be last afloat, or be richest after {DEFAULT_CONFIG.maxRounds} rounds to win.
      </p>

      <label>
        Navigator name
        <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="field">
        Nation
        <div className="choices">
          {NATIONS.map((n, i) => (
            <button
              key={n.name}
              className={i === nation ? 'chip selected' : 'chip'}
              style={{ borderColor: cssColor(n.color) }}
              onClick={() => setNation(i)}
            >
              <span className="dot" style={{ background: cssColor(n.color) }} />
              {n.name}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        AI rivals
        <div className="choices">
          {[1, 2, 3].map((n) => (
            <button key={n} className={n === rivals ? 'chip selected' : 'chip'} onClick={() => setRivals(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <button onClick={onRules}>How to play</button>
      <button className="primary big" onClick={start}>
        Set sail
      </button>
    </div>
  );
}
