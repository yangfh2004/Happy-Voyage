import { useState } from 'react';
import { CAPTAINS, MAX_CAPTAINS, captainDescriptionText, captainName, rankName, type GameState } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { gameController } from '../game/GameController';
import { StatTooltip } from './StatTooltip';

export function RecruitPanel({ state }: { state: GameState }) {
  const [error, setError] = useState('');
  const { t, locale } = useT();
  const player = state.players[state.currentPlayer];
  const full = player.captains.length >= MAX_CAPTAINS;
  function recruit(index: number) {
    try { gameController.recruitCaptain(index); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('Recruitment failed', '招募失败')); }
  }
  return <section aria-labelledby="recruit-title">
    <h2 id="recruit-title">{t("Dragon Snake Island · Sailors' tavern", '龙蛇岛 · 水手酒馆')}</h2>
    <p>{t('Talk to sailors and recruit one captain. Bonuses last while aboard; higher royal ranks unlock better captains.', '与水手交谈并招募一位船长。船长在船上时加成持续有效；王室官阶越高，可招募的船长越好。')}</p>
    <p><StatTooltip stat="captains">{t('Captains aboard: {n}/{m}', '船上的船长：{n}/{m}', { n: player.captains.length, m: MAX_CAPTAINS })}</StatTooltip>{t('. ', '。')}<StatTooltip stat="gold">{t('Treasury: {g}g', '金库：{g} 金币', { g: player.gold })}</StatTooltip>{t('.', '。')}</p>
    {full && <p>{t('Crew is full. No more captains can join.', '船员已满，无法再招募船长。')}</p>}
    {error && <p role="alert">{error}</p>}
    {(state.pendingRecruits ?? []).map((id, index) => {
      const captain = CAPTAINS.find((candidate) => candidate.id === id)!;
      return <div className="building-option" key={id}>
        <strong>{captainName(captain.id, locale)}</strong>
        <p>{captainDescriptionText(captain.id, locale)} · {t('Requires {r}', '需要{r}', { r: rankName(captain.minRank, locale) })} · {captain.fee}{t('g', ' 金币')}</p>
        <button className="primary" disabled={full || player.gold < captain.fee || player.rank < captain.minRank || player.captains.includes(id)} onClick={() => recruit(index)}>{t('Recruit {c}', '招募{c}', { c: captainName(captain.id, locale) })}</button>
      </div>;
    })}
    <button onClick={() => gameController.declineRecruit()}>{t('Decline recruitment', '婉拒招募')}</button>
  </section>;
}
