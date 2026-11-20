import { useState } from 'react';
import { createNationRoster, DEFAULT_CONFIG, NATIONS, type Nation } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { cssColor } from './nations';
import { SpeedControl } from './SpeedControl';
import { ShortcutLegend } from './ShortcutLegend';

/** Start screen: pick a navigator and their home nation. */
export function SetupMenu({ onRules }: { onRules: () => void }) {
  const [name, setName] = useState('Captain');
  const [nation, setNation] = useState<Nation>(NATIONS[0].name);

  const start = () => {
    gameController.newGame(createNationRoster([{ name: name.trim() || 'Captain', nation }]));
  };

  return (
    <div className="panel setup">
      <h1>Happy Voyage</h1>
      <p className="subtitle">Seven Seas Domination · 欢乐大航海</p>
      <p>
        Spin the compass, sail the route and plant your flag on new lands. Rivals pay you a toll when they
        land on your colonies. Claim {DEFAULT_CONFIG.islandsToWin} islands, be last afloat, or be richest after {DEFAULT_CONFIG.maxRounds} rounds to win.
        The starting navigator rotates each round. Final wealth is cash plus 75% of colony costs.
      </p>

      <label>
        Navigator name
        <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="field nations" role="group" aria-labelledby="nation-label">
        <span id="nation-label">Nation</span>
        <div className="choices">
          {NATIONS.map((n) => (
            <button
              key={n.name}
              className={n.name === nation ? 'chip selected' : 'chip'}
              aria-pressed={n.name === nation}
              style={{ borderColor: cssColor(n.color) }}
              onClick={() => setNation(n.name)}
            >
              <span className="dot" style={{ background: cssColor(n.color) }} />
              {n.name}
            </button>
          ))}
        </div>
        <small className="nation-note">Start at {nation} Port. The other {NATIONS.length - 1} nations are AI rivals.</small>
      </div>

      <button className="setup-rules" onClick={onRules}>How to play</button>
      <SpeedControl />
      <ShortcutLegend />
      <button className="primary big" onClick={start}>
        Set sail
      </button>
    </div>
  );
}
