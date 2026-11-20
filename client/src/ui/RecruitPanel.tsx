import { useState } from 'react';
import { CAPTAINS, MAX_CAPTAINS, RANKS, captainDescription, type GameState } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';

export function RecruitPanel({ state }: { state: GameState }) {
  const [error, setError] = useState('');
  const player = state.players[state.currentPlayer];
  const full = player.captains.length >= MAX_CAPTAINS;
  function recruit(index: number) {
    try { gameController.recruitCaptain(index); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Recruitment failed'); }
  }
  return <section aria-labelledby="recruit-title">
    <h2 id="recruit-title">Dragon Snake Island · Sailors' tavern</h2>
    <p>Talk to sailors and recruit one captain. Bonuses last while aboard; higher royal ranks unlock better captains.</p>
    <p>Captains aboard: {player.captains.length}/{MAX_CAPTAINS}. Treasury: {player.gold}g.</p>
    {full && <p>Crew is full. No more captains can join.</p>}
    {error && <p role="alert">{error}</p>}
    {(state.pendingRecruits ?? []).map((id, index) => {
      const captain = CAPTAINS.find((candidate) => candidate.id === id)!;
      return <div className="building-option" key={id}>
        <strong>{captain.name}</strong>
        <p>{captainDescription(captain)} · Requires {RANKS[captain.minRank].name} · {captain.fee}g</p>
        <button className="primary" disabled={full || player.gold < captain.fee || player.rank < captain.minRank || player.captains.includes(id)} onClick={() => recruit(index)}>Recruit {captain.name}</button>
      </div>;
    })}
    <button onClick={() => gameController.declineRecruit()}>Decline recruitment</button>
  </section>;
}
