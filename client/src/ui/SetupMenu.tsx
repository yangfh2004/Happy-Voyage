import { useState } from 'react';
import { createNationRoster, DEFAULT_CONFIG, NATIONS, navigatorForNation, type AIDifficulty, type Nation } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { cssColor } from './nations';
import { NavigatorCard } from './NavigatorCard';
import { NavigatorPortrait } from './NavigatorPortrait';
import { SpeedControl } from './SpeedControl';
import { ShortcutLegend } from './ShortcutLegend';

/** Start screen: pick a nation, meet its navigator and their signature ship. */
export function SetupMenu({ onRules }: { onRules: () => void }) {
  const [customName, setCustomName] = useState<string | null>(null);
  const [nation, setNation] = useState<Nation>(NATIONS[0].name);
  const [difficulty, setDifficulty] = useState<AIDifficulty>('normal');
  const navigator = navigatorForNation(nation)!;
  const color = NATIONS.find((n) => n.name === nation)!.color;
  const name = customName ?? navigator.name;

  const start = () => {
    gameController.newGame(createNationRoster([{ name: name.trim() || navigator.name, nation }], difficulty));
  };

  return (
    <div className="panel setup">
      <h1>Happy Voyage</h1>
      <p className="subtitle">Seven Seas Domination · 欢乐大航海</p>
      <p>
        Spin the compass, sail the route and plant your flag on new lands. Rivals pay you a toll or attack when they
        land on your colonies. Claim {DEFAULT_CONFIG.islandsToWin} islands, be last afloat, or be richest after {DEFAULT_CONFIG.maxRounds} rounds to win.
        The starting navigator rotates each round. Final wealth is cash plus 75% of colony costs.
      </p>

      <label className="setup-name">
        Navigator name
        <input value={name} maxLength={16} onChange={(e) => setCustomName(e.target.value)} />
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
              <NavigatorPortrait navigator={navigatorForNation(n.name)!.id} color={n.color} size={24} />
              {n.name}
            </button>
          ))}
        </div>
        <NavigatorCard navigator={navigator} color={color} />
        <small className="nation-note">Start at {nation} Port. The other {NATIONS.length - 1} nations are AI rivals.</small>
      </div>

      <label className="setup-difficulty">
        Rival difficulty
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as AIDifficulty)}>
          <option value="easy">Easy</option>
          <option value="normal">Normal</option>
          <option value="hard">Hard</option>
        </select>
        <small className="nation-note">Changes rival decisions, not starting resources or rules.</small>
      </label>

      <button className="setup-rules" onClick={onRules}>How to play</button>
      <SpeedControl />
      <ShortcutLegend />
      <button className="primary big" onClick={start}>
        Set sail
      </button>
    </div>
  );
}
