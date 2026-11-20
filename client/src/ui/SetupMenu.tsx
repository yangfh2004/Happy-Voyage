import { useState } from 'react';
import { createNationRoster, DEFAULT_ISLAND_COUNT, GAME_MODES, gameMode, NATIONS, navigatorForNation, winConditionText, type AIDifficulty, type GameModeId, type Nation } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { cssColor } from './nations';
import { NavigatorCard } from './NavigatorCard';
import { NavigatorPortrait } from './NavigatorPortrait';
import { SpeedControl } from './SpeedControl';
import { ShortcutLegend } from './ShortcutLegend';

export const MAX_LOCAL_PLAYERS = 6;

interface Seat {
  customName: string | null;
  nation: Nation;
}

const seatName = (seat: Seat) => seat.customName ?? navigatorForNation(seat.nation)!.name;

/** Start screen: seat one or more people on this device, each with a nation; AI takes the rest. */
export function SetupMenu({ onRules }: { onRules: () => void }) {
  const [seats, setSeats] = useState<Seat[]>([{ customName: null, nation: NATIONS[0].name }]);
  const [active, setActive] = useState(0);
  const [modeId, setModeId] = useState<GameModeId>(GAME_MODES[0].id);
  const mode = gameMode(modeId);
  const [difficulty, setDifficulty] = useState<AIDifficulty>('normal');
  const seat = seats[active];
  const navigator = navigatorForNation(seat.nation)!;
  const color = NATIONS.find((n) => n.name === seat.nation)!.color;
  const takenBy = (nation: Nation) => seats.findIndex((other, i) => i !== active && other.nation === nation);
  const multi = seats.length > 1;

  const update = (change: Partial<Seat>) => setSeats(seats.map((s, i) => (i === active ? { ...s, ...change } : s)));
  const addSeat = () => {
    const free = NATIONS.find((n) => !seats.some((s) => s.nation === n.name));
    if (!free || seats.length >= MAX_LOCAL_PLAYERS) return;
    setSeats([...seats, { customName: null, nation: free.name }]);
    setActive(seats.length);
  };
  const removeSeat = () => {
    if (!multi) return;
    setSeats(seats.filter((_, i) => i !== active));
    setActive(Math.max(0, active - 1));
  };

  const start = () => {
    gameController.newGame(createNationRoster(seats.map((s) => ({
      name: seatName(s).trim() || navigatorForNation(s.nation)!.name,
      nation: s.nation,
    })), difficulty), mode.config);
  };

  return (
    <div className="panel setup">
      <h1>Happy Voyage</h1>
      <p className="subtitle">Seven Seas Domination · 欢乐大航海</p>
      <p>
        Spin the compass, sail the route and plant your flag on new lands. Rivals pay you a toll or attack when they
        land on your colonies. To win, {winConditionText(mode.config, DEFAULT_ISLAND_COUNT)}.
        The starting navigator rotates each round. Final wealth is cash plus 75% of colony costs.
      </p>

      <div className="field seats" role="group" aria-labelledby="seats-label">
        <span id="seats-label">Players on this device</span>
        <div className="seat-count">
          <button aria-label="Remove player" disabled={!multi} onClick={removeSeat}>−</button>
          <strong aria-live="polite">{seats.length}</strong>
          <button aria-label="Add player" disabled={seats.length >= MAX_LOCAL_PLAYERS} onClick={addSeat}>+</button>
          <small className="nation-note">Up to {MAX_LOCAL_PLAYERS} people take turns; pass the device when prompted.</small>
        </div>
        {multi && (
          <div className="choices" role="tablist" aria-label="Seat to edit">
            {seats.map((s, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === active}
                className={i === active ? 'chip selected' : 'chip'}
                style={{ borderColor: cssColor(NATIONS.find((n) => n.name === s.nation)!.color) }}
                onClick={() => setActive(i)}
              >
                P{i + 1} · {seatName(s)} · {s.nation}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="setup-name">
        {multi ? `Player ${active + 1} navigator name` : 'Navigator name'}
        <input value={seatName(seat)} maxLength={16} onChange={(e) => update({ customName: e.target.value })} />
      </label>

      <div className="field nations" role="group" aria-labelledby="nation-label">
        <span id="nation-label">{multi ? `Player ${active + 1} nation` : 'Nation'}</span>
        <div className="choices">
          {NATIONS.map((n) => {
            const owner = takenBy(n.name);
            return (
              <button
                key={n.name}
                className={n.name === seat.nation ? 'chip selected' : 'chip'}
                aria-pressed={n.name === seat.nation}
                disabled={owner >= 0}
                title={owner >= 0 ? `Taken by P${owner + 1}` : undefined}
                style={{ borderColor: cssColor(n.color) }}
                onClick={() => update({ nation: n.name })}
              >
                <NavigatorPortrait navigator={navigatorForNation(n.name)!.id} color={n.color} size={24} />
                {n.name}
                {owner >= 0 && <small> (P{owner + 1})</small>}
              </button>
            );
          })}
        </div>
        <NavigatorCard navigator={navigator} color={color} />
        <small className="nation-note">
          {multi ? `${seats.length} players start at their home ports.` : `Start at ${seat.nation} Port.`} The other {NATIONS.length - seats.length} nations are AI rivals.
        </small>
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

      <div className="field modes" role="group" aria-labelledby="mode-label">
        <span id="mode-label">Victory</span>
        <div className="choices">
          {GAME_MODES.map((m) => (
            <button key={m.id} className={m.id === modeId ? 'chip selected' : 'chip'} aria-pressed={m.id === modeId} onClick={() => setModeId(m.id)}>
              {m.name}
            </button>
          ))}
        </div>
        <small className="nation-note">{mode.description}</small>
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
