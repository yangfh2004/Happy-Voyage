import { useRef, useState } from 'react';
import { GAME_MODES, MAX_ROOM_PLAYERS, MIN_ROOM_PLAYERS, NATIONS, ROOM_ID_PATTERN, modeText, nationName, type AIDifficulty, type GameModeId, type Nation } from '@happy-voyage/shared';
import { useT } from '../i18n';
import type { Locale } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { OFFLINE, roomInviteLink, type OnlineRoom } from '../game/OnlineRoom';

const ROOM_ERRORS_ZH: Record<string, string> = {
  [OFFLINE]: '无法连接房间服务器。',
  'This seat was opened in another browser. Reopen the invite to return.': '这个座位已在另一个浏览器中打开。重新打开邀请链接即可回来。',
  'The room did not respond. Try again.': '房间没有响应，请重试。',
  'Room connection lost.': '与房间的连接已断开。',
};

/** Room errors come from the client and server in English; show the Chinese wording when we have it. */
export function roomError(error: string, locale: Locale): string {
  return locale === 'zh' ? ROOM_ERRORS_ZH[error] ?? error : error;
}

const DIFFICULTY = { easy: ['Easy', '简单'], normal: ['Normal', '普通'], hard: ['Hard', '困难'] } as const;

export function OnlineMenu({ room }: { room: OnlineRoom }) {
  const [name, setName] = useState('');
  const [nation, setNation] = useState<Nation>(NATIONS[0].name);
  const [mode, setMode] = useState<GameModeId>('conquest');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('normal');
  const [copied, setCopied] = useState(false);
  const inviteField = useRef<HTMLInputElement>(null);
  const { invite, lobby, pass, ready, busy, error } = room;
  const invalid = invite !== null && !ROOM_ID_PATTERN.test(invite);
  const { t, locale } = useT();
  const level = (d: AIDifficulty) => DIFFICULTY[d][locale === 'zh' ? 1 : 0];

  return (
    <div className="panel setup online-menu">
      <h1>{lobby ? t('Online room', '在线房间') : invite ? t('Join an online room', '加入在线房间') : t('Host an online room', '创建在线房间')}</h1>
      {lobby ? (
        <>
          <p>{modeText(lobby.mode, locale).name} · {t('{d} rivals', '{d}对手', { d: level(lobby.difficulty) })}</p>
          <label>{t('Invite link', '邀请链接')}
            <input ref={inviteField} value={roomInviteLink(lobby.id).href} readOnly onFocus={(event) => event.currentTarget.select()} />
          </label>
          <button type="button" onClick={async () => {
            try {
              await navigator.clipboard.writeText(roomInviteLink(lobby.id).href);
              setCopied(true);
            } catch {
              setCopied(false);
              inviteField.current?.focus();
              inviteField.current?.select();
            }
          }}>{copied ? t('Link copied', '链接已复制') : t('Copy invite link', '复制邀请链接')}</button>
          <h2>{t('Players ({n}/{m})', '玩家（{n}/{m}）', { n: lobby.seats.length, m: MAX_ROOM_PLAYERS })}</h2>
          <ul>{lobby.seats.map((seat) =>
            <li key={seat.id}>{seat.name} · {nationName(seat.nation, locale)}{seat.id === lobby.host && t(' · Host', ' · 房主')}{seat.id === pass?.seatId && t(' · You', ' · 你')}
              {!seat.connected && t(' · Reconnecting…', ' · 重新连接中……')}</li>,
          )}</ul>
          <p>{t('Unclaimed nations are played by AI rivals.', '无人选择的国家由电脑对手操控。')}</p>
          {!ready ? <p role="status">{t('Reconnecting to the room…', '正在重新连接房间……')}</p>
            : lobby.host === pass?.seatId ? (
              <button className="primary big" disabled={busy || lobby.started || lobby.seats.length < MIN_ROOM_PLAYERS || lobby.seats.some((seat) => !seat.connected)}
                onClick={() => room.start()}>{t('Start voyage', '开始航程')}</button>
            ) : <p role="status">{t('Waiting for the host to start the voyage.', '正在等待房主开始航程。')}</p>}
        </>
      ) : invalid ? <p role="alert">{t('This invite link is invalid.', '这个邀请链接无效。')}</p> : (
        <form onSubmit={(event) => {
          event.preventDefault();
          const pick = { name, nation };
          if (invite) room.join(pick);
          else room.create(pick, { mode, difficulty });
        }}>
          <p>{t('Play with 2–6 people. Each player chooses a different nation.', '2–6 人一起玩，每位玩家选择不同的国家。')}</p>
          <label>{t('Navigator name', '航海家名字')}
            <input value={name} placeholder={t("Use the nation's navigator", '使用该国的航海家')} maxLength={16} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>{t('Nation', '国家')}
            <select value={nation} onChange={(event) => setNation(event.target.value as Nation)}>
              {NATIONS.map(({ name }) => <option key={name} value={name}>{nationName(name, locale)}</option>)}
            </select>
          </label>
          {!invite && <>
            <label>{t('Victory', '胜利条件')}
              <select value={mode} onChange={(event) => setMode(event.target.value as GameModeId)}>
                {GAME_MODES.map(({ id }) => <option key={id} value={id}>{modeText(id, locale).name}</option>)}
              </select>
            </label>
            <label>{t('Rival difficulty', '对手难度')}
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as AIDifficulty)}>
                <option value="easy">{level('easy')}</option><option value="normal">{level('normal')}</option><option value="hard">{level('hard')}</option>
              </select>
            </label>
          </>}
          <button className="primary big" disabled={busy} type="submit">{busy ? t('Connecting…', '连接中……') : invite ? t('Join room', '加入房间') : t('Create room', '创建房间')}</button>
        </form>
      )}
      {error && <p role="alert">{roomError(error, locale)}</p>}
      <button type="button" onClick={() => gameController.quit()}>{lobby ? t('Leave room', '离开房间') : t('Back to local play', '返回本地游戏')}</button>
    </div>
  );
}
