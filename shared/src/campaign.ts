import { ZH, registerCampaignText, type Locale } from './i18n';
import { NO_ROUND_LIMIT } from './modes';
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

export const CAMPAIGN_STAGES: readonly CampaignStage[] = [
  {
    id: 'first-voyage',
    name: 'First Voyage',
    briefing: 'Plant the crown’s flag on a new land and return home to report your discovery.',
    rivals: 1,
    difficulty: 'easy',
    config: { startingGold: 1400, homeSalary: 400, maxRounds: NO_ROUND_LIMIT },
    missions: [
      { objective: 'foundColony', description: 'Found a colony on an unclaimed island', target: 1, reward: 150 },
      { objective: 'reportHome', description: 'Land at your home port while holding a colony', target: 1, reward: 250 },
    ],
  },
  {
    id: 'merchant-charter',
    name: 'The Merchant Charter',
    briefing: 'Sail to Nightless Island to sell specialties, and build a collection field to supply future voyages.',
    rivals: 2,
    difficulty: 'normal',
    config: { startingGold: 1600, homeSalary: 400, maxRounds: 28 },
    missions: [
      { objective: 'sellSpecialties', description: 'Sell 3 units of specialties at Nightless Island', target: 3, reward: 200 },
      { objective: 'buildCollectionField', description: 'Build a collection field at one of your colonies', target: 1, reward: 250 },
    ],
  },
  {
    id: 'crown-of-the-seas',
    name: 'Crown of the Seas',
    briefing: 'Expand your fleet’s territory and take a rival colony before the crown’s deadline.',
    rivals: 3,
    difficulty: 'hard',
    config: { startingGold: 1200, homeSalary: 300, maxRounds: 20 },
    missions: [
      { objective: 'holdColonies', description: 'Hold 2 colonies at the same time', target: 2, reward: 250 },
      { objective: 'captureColony', description: 'Win a naval battle to capture a rival colony', target: 1, reward: 400 },
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
