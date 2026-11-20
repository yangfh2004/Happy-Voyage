import { campaignStage, type CampaignState } from '@happy-voyage/shared';
import { StatTooltip } from './StatTooltip';

export function CampaignPanel({ campaign }: { campaign: CampaignState }) {
  const stage = campaignStage(campaign.stage);

  return (
    <section className="panel campaign" aria-labelledby="campaign-title">
      <h2 id="campaign-title">{stage.name}</h2>
      <h3>King’s missions</h3>
      <ul>
        {stage.missions.map((mission) => {
          const progress = campaign.progress[mission.objective] ?? 0;
          const complete = progress >= mission.target;
          return (
            <li key={mission.objective}>
              <span>{mission.description}</span>
              <small><StatTooltip stat="progress">{complete ? `Complete · ${mission.reward}g awarded` : `${progress} / ${mission.target} · ${mission.reward}g reward`}</StatTooltip></small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
