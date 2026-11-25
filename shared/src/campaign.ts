import { ZH, registerCampaignText, type Locale } from './i18n';
import { GAMEPLAY_TUNING } from './gameplayTuning';
import { createNationRoster, type NationPick } from './nations';
import type { AIDifficulty, GameConfig } from './types';

export type CampaignStageId = 'first-voyage' | 'merchant-charter' | 'crown-of-the-seas';
export type CampaignObjective = 'foundColony' | 'reportHome' | 'sellSpecialties' | 'buildCollectionField' | 'holdColonies' | 'captureColony';

export interface CampaignMission {
  objective: CampaignObjective;
  description: string;
  target: number;
  reward: number;
}

export interface CampaignStage {
  id: CampaignStageId;
  name: string;
  briefing: string;
  rivals: number;
  difficulty: AIDifficulty;
  config: Pick<GameConfig, 'startingGold' | 'homeSalary' | 'maxRounds'>;
  missions: readonly CampaignMission[];
}

export interface CampaignSetup {
  stage: CampaignStageId;
  navigator: NationPick;
}

export interface CampaignState {
  stage: CampaignStageId;
  playerId: number;
  progress: Partial<Record<CampaignObjective, number>>;
  status: 'active' | 'completed' | 'failed';
}

const rules = GAMEPLAY_TUNING.campaign;

export const CAMPAIGN_STAGES: readonly CampaignStage[] = [
  {
    id: 'first-voyage',
    name: 'First Voyage',
    briefing: 'Plant the crown’s flag on a new land and return home to report your discovery.',
    get rivals() { return rules['first-voyage'].rivals; },
    difficulty: 'easy',
    config: rules['first-voyage'].config,
    missions: [
      { objective: 'foundColony', description: 'Found a colony on an unclaimed island', get target() { return rules['first-voyage'].foundColony.target; }, get reward() { return rules['first-voyage'].foundColony.reward; } },
      { objective: 'reportHome', description: 'Land at your home port while holding a colony', get target() { return rules['first-voyage'].reportHome.target; }, get reward() { return rules['first-voyage'].reportHome.reward; } },
    ],
  },
  {
    id: 'merchant-charter',
    name: 'The Merchant Charter',
    briefing: 'Sail to Nightless Island to sell specialties, and build a collection field to supply future voyages.',
    get rivals() { return rules['merchant-charter'].rivals; },
    difficulty: 'normal',
    config: rules['merchant-charter'].config,
    missions: [
      { objective: 'sellSpecialties', description: 'Sell 3 units of specialties at Nightless Island', get target() { return rules['merchant-charter'].sellSpecialties.target; }, get reward() { return rules['merchant-charter'].sellSpecialties.reward; } },
      { objective: 'buildCollectionField', description: 'Build a collection field at one of your colonies', get target() { return rules['merchant-charter'].buildCollectionField.target; }, get reward() { return rules['merchant-charter'].buildCollectionField.reward; } },
    ],
  },
  {
    id: 'crown-of-the-seas',
    name: 'Crown of the Seas',
    briefing: 'Expand your fleet’s territory and take a rival colony before the crown’s deadline.',
    get rivals() { return rules['crown-of-the-seas'].rivals; },
    difficulty: 'hard',
    config: rules['crown-of-the-seas'].config,
    missions: [
      { objective: 'holdColonies', description: 'Hold 2 colonies at the same time', get target() { return rules['crown-of-the-seas'].holdColonies.target; }, get reward() { return rules['crown-of-the-seas'].holdColonies.reward; } },
      { objective: 'captureColony', description: 'Win a naval battle to capture a rival colony', get target() { return rules['crown-of-the-seas'].captureColony.target; }, get reward() { return rules['crown-of-the-seas'].captureColony.reward; } },
    ],
  },
];

export function campaignStage(id: CampaignStageId): CampaignStage {
  const stage = CAMPAIGN_STAGES.find((candidate) => candidate.id === id);
  if (!stage) throw new Error(`Unknown campaign stage: ${id}`);
  return stage;
}

export function campaignRoster(navigator: NationPick, stage: CampaignStage) {
  return createNationRoster([navigator], stage.difficulty).slice(0, 1 + stage.rivals);
}

export function stageText(id: CampaignStageId, locale: Locale): { name: string; briefing: string } {
  const stage = CAMPAIGN_STAGES.find((candidate) => candidate.id === id)!;
  return locale === 'zh' ? ZH.stages[id] : { name: stage.name, briefing: stage.briefing };
}

export function missionText(stageId: CampaignStageId, objective: CampaignObjective, locale: Locale): string {
  if (locale === 'zh') return ZH.missions[objective];
  return CAMPAIGN_STAGES.find((stage) => stage.id === stageId)!.missions.find((mission) => mission.objective === objective)!.description;
}

registerCampaignText({ stage: stageText, mission: missionText });
