import { useState } from 'react';
import { CAMPAIGN_STAGES, campaignStage, createNationRoster, DEFAULT_ISLAND_COUNT, GAME_MODES, gameMode, hasRoundLimit, NATIONS, navigatorForNation, winConditionText, type AIDifficulty, type CampaignStageId, type GameModeId, type Nation } from '@happy-voyage/shared';
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
  const [modeId, setModeId] = useState<GameModeId | 'campaign'>(GAME_MODES[0].id);
  const [stageId, setStageId] = useState<CampaignStageId>(CAMPAIGN_STAGES[0].id);
  const mode = modeId === 'campaign' ? null : gameMode(modeId);
  const stage = campaignStage(stageId);
  const rivals = mode ? NATIONS.length - 1 : stage.rivals;
  const [difficulty, setDifficulty] = useState<AIDifficulty>('normal');
  const navigator = navigatorForNation(nation)!;
  const color = NATIONS.find((n) => n.name === nation)!.color;
  const name = customName ?? navigator.name;

  const start = () => {
    const pick = { name: name.trim() || navigator.name, nation };
    if (mode) gameController.newGame(createNationRoster([pick], difficulty), mode.config);
    else gameController.newCampaign({ stage: stageId, navigator: pick });
  };

  return (
    <div className="panel setup">
      <h1>Happy Voyage</h1>
      <p className="subtitle">Seven Seas Domination · 欢乐大航海</p>
      <p>
        {mode ? <>Spin the compass, sail the route and plant your flag on new lands. Rivals pay you a toll or attack when they
          land on your colonies. To win, {winConditionText(mode.config, DEFAULT_ISLAND_COUNT)}.
          The starting navigator rotates each round. Final wealth is cash plus 75% of colony costs.</>
          : 'Take on the king’s missions in three standalone campaign stages. Finish every mission in a stage to win.'}
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
        <small className="nation-note">Start at {nation} Port with {rivals} AI {rivals === 1 ? 'rival' : 'rivals'} on the chart.</small>
      </div>

      {mode && <label className="setup-difficulty">
        Rival difficulty
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as AIDifficulty)}>
          <option value="easy">Easy</option>
          <option value="normal">Normal</option>
          <option value="hard">Hard</option>
        </select>
        <small className="nation-note">Changes rival decisions, not starting resources or rules.</small>
      </label>}

      <div className="field modes" role="group" aria-labelledby="mode-label">
        <span id="mode-label">Game mode</span>
        <div className="choices">
          {GAME_MODES.map((m) => (
            <button key={m.id} className={m.id === modeId ? 'chip selected' : 'chip'} aria-pressed={m.id === modeId} onClick={() => setModeId(m.id)}>
              {m.name}
            </button>
          ))}
          <button className={modeId === 'campaign' ? 'chip selected' : 'chip'} aria-pressed={modeId === 'campaign'} onClick={() => setModeId('campaign')}>
            Campaign
          </button>
        </div>
        {mode ? <small className="nation-note">{mode.description}</small> : (
          <>
            <label>
              Campaign stage
              <select value={stageId} onChange={(e) => setStageId(e.target.value as CampaignStageId)}>
                {CAMPAIGN_STAGES.map((candidate, index) => <option key={candidate.id} value={candidate.id}>{index + 1}. {candidate.name}</option>)}
              </select>
            </label>
            <small className="nation-note">{stage.briefing}</small>
            <small className="nation-note">{stage.rivals} {stage.difficulty} {stage.rivals === 1 ? 'rival' : 'rivals'} · {hasRoundLimit(stage.config) ? `${stage.config.maxRounds} rounds` : 'No round limit'} · Start with Navigation.</small>
          </>
        )}
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
