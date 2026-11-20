import { useRef, useState } from 'react';
import { GAME_MODES, MAX_ROOM_PLAYERS, MIN_ROOM_PLAYERS, NATIONS, ROOM_ID_PATTERN, type AIDifficulty, type GameModeId, type Nation } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { roomLink, type OnlineRoom } from '../game/OnlineRoom';

export function OnlineMenu({ room }: { room: OnlineRoom }) {
  const [name, setName] = useState('');
  const [nation, setNation] = useState<Nation>(NATIONS[0].name);
  const [mode, setMode] = useState<GameModeId>('conquest');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('normal');
  const [copied, setCopied] = useState(false);
  const inviteField = useRef<HTMLInputElement>(null);
  const { invite, lobby, pass, ready, busy, error } = room;
  const invalid = invite !== null && !ROOM_ID_PATTERN.test(invite);

  return (
    <div className="panel setup online-menu">
      <h1>{lobby ? 'Online room' : invite ? 'Join an online room' : 'Host an online room'}</h1>
      {lobby ? (
        <>
          <p>{GAME_MODES.find(({ id }) => id === lobby.mode)?.name} · {lobby.difficulty} rivals</p>
          <label>Invite link
            <input ref={inviteField} value={roomLink(lobby.id).href} readOnly onFocus={(event) => event.currentTarget.select()} />
          </label>
          <button type="button" onClick={async () => {
            try {
              await navigator.clipboard.writeText(roomLink(lobby.id).href);
              setCopied(true);
            } catch {
              setCopied(false);
              inviteField.current?.focus();
              inviteField.current?.select();
            }
          }}>{copied ? 'Link copied' : 'Copy invite link'}</button>
          <h2>Players ({lobby.seats.length}/{MAX_ROOM_PLAYERS})</h2>
          <ul>{lobby.seats.map((seat) =>
            <li key={seat.id}>{seat.name} · {seat.nation}{seat.id === lobby.host && ' · Host'}{seat.id === pass?.seatId && ' · You'}
              {!seat.connected && ' · Reconnecting…'}</li>,
          )}</ul>
          <p>Unclaimed nations are played by AI rivals.</p>
          {!ready ? <p role="status">Reconnecting to the room…</p>
            : lobby.host === pass?.seatId ? (
              <button className="primary big" disabled={busy || lobby.started || lobby.seats.length < MIN_ROOM_PLAYERS || lobby.seats.some((seat) => !seat.connected)}
                onClick={() => room.start()}>Start voyage</button>
            ) : <p role="status">Waiting for the host to start the voyage.</p>}
        </>
      ) : invalid ? <p role="alert">This invite link is invalid.</p> : (
        <form onSubmit={(event) => {
          event.preventDefault();
          const pick = { name, nation };
          if (invite) room.join(pick);
          else room.create(pick, { mode, difficulty });
        }}>
          <p>Play with 2–6 people. Each player chooses a different nation.</p>
          <label>Navigator name
            <input value={name} placeholder="Use the nation's navigator" maxLength={16} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>Nation
            <select value={nation} onChange={(event) => setNation(event.target.value as Nation)}>
              {NATIONS.map(({ name }) => <option key={name}>{name}</option>)}
            </select>
          </label>
          {!invite && <>
            <label>Victory
              <select value={mode} onChange={(event) => setMode(event.target.value as GameModeId)}>
                {GAME_MODES.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label>Rival difficulty
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as AIDifficulty)}>
                <option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option>
              </select>
            </label>
          </>}
          <button className="primary big" disabled={busy} type="submit">{busy ? 'Connecting…' : invite ? 'Join room' : 'Create room'}</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={() => gameController.quit()}>{lobby ? 'Leave room' : 'Back to local play'}</button>
    </div>
  );
}
