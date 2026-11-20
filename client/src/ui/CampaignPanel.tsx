import { campaignStage, missionText, stageText, type CampaignState } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { StatTooltip } from './StatTooltip';

export function CampaignPanel({ campaign }: { campaign: CampaignState }) {
  const stage = campaignStage(campaign.stage);
  const { t, locale } = useT();

  return (
    <section className="panel campaign" aria-labelledby="campaign-title">
      <h2 id="campaign-title">{stageText(stage.id, locale).name}</h2>
      <h3>{t('King’s missions', '国王使命')}</h3>
      <ul>
        {stage.missions.map((mission) => {
          const progress = campaign.progress[mission.objective] ?? 0;
          const complete = progress >= mission.target;
          return (
            <li key={mission.objective}>
              <span>{missionText(stage.id, mission.objective, locale)}</span>
              <small><StatTooltip stat="progress">{complete ? t('Complete · {g}g awarded', '已完成 · 已奖励 {g} 金币', { g: mission.reward }) : t('{p} / {n} · {g}g reward', '{p} / {n} · 奖励 {g} 金币', { p: progress, n: mission.target, g: mission.reward })}</StatTooltip></small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
