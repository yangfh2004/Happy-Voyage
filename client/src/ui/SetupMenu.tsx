import { useState, type ReactNode } from 'react';
import { CAMPAIGN_STAGES, campaignStage, createNationRoster, DEFAULT_ISLAND_COUNT, GAME_MODES, gameMode, hasRoundLimit, modeText, NATIONS, nationName, navigatorForNation, playerName, stageText, winConditionTx, type AIDifficulty, type CampaignStageId, type GameModeId, type Nation } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { cssColor } from './nations';
import { NavigatorCard } from './NavigatorCard';
import { NavigatorPortrait } from './NavigatorPortrait';
import { SpeedControl } from './SpeedControl';
import { SoundControl } from './SoundControl';
import { ShortcutLegend } from './ShortcutLegend';
import { LanguageSwitch } from './LanguageSwitch';
import { useT } from '../i18n';
import { tx } from '@happy-voyage/shared';

interface Seat {
  customName: string | null;
  nation: Nation;
}

const seatName = (seat: Seat) => seat.customName ?? navigatorForNation(seat.nation)!.name;
const seatLabel = (seat: Seat, locale: 'en' | 'zh') => seat.customName ?? playerName({ name: navigatorForNation(seat.nation)!.name, navigator: navigatorForNation(seat.nation)!.id }, locale);

/** Start screen: seat one or more people on this device, each with a nation; AI takes the rest. */
export function SetupMenu({ onRules, paletteToggle, onBack }: { onRules: () => void; paletteToggle?: ReactNode; onBack?: () => void }) {
  const { t, l, locale } = useT();
  const [seats, setSeats] = useState<Seat[]>([{ customName: null, nation: NATIONS[0].name }]);
  const [active, setActive] = useState(0);
  const { total, humanLimit } = gameController.localTuning.localSeats;
  const [totalPlayers, setTotalPlayers] = useState(total);
  const [battleMode, setBattleMode] = useState<'realtime' | 'auto'>('realtime');
  const [modeId, setModeId] = useState<GameModeId | 'campaign'>(GAME_MODES[0].id);
  const [stageId, setStageId] = useState<CampaignStageId>(CAMPAIGN_STAGES[0].id);
  const mode = modeId === 'campaign' ? null : { ...gameMode(modeId), config: gameController.localTuning.modes[modeId] };
  const stage = { ...campaignStage(stageId), ...gameController.localTuning.campaign[stageId] };
  const [difficulty, setDifficulty] = useState<AIDifficulty>('normal');
  const seatIndex = mode ? active : 0;
  const [campaignSeat, setCampaignSeat] = useState<Seat>({ customName: null, nation: NATIONS[0].name });
  const seat = mode ? seats[seatIndex] : campaignSeat;
  const navigator = navigatorForNation(seat.nation)!;
  const color = NATIONS.find((n) => n.name === seat.nation)!.color;
  const takenBy = (nation: Nation) => mode ? seats.findIndex((other, i) => i !== seatIndex && other.nation === nation) : -1;
  const multi = !!mode && seats.length > 1;

  const update = (change: Partial<Seat>) => {
    if (mode) setSeats(seats.map((s, i) => (i === seatIndex ? { ...s, ...change } : s)));
    else setCampaignSeat({ ...campaignSeat, ...change });
  };
  const addSeat = () => {
    const free = NATIONS.find((n) => !seats.some((s) => s.nation === n.name));
    if (!free || seats.length >= Math.min(humanLimit, totalPlayers)) return;
    setSeats([...seats, { customName: null, nation: free.name }]);
    setActive(seats.length);
  };
  const removeSeat = () => {
    if (!multi) return;
    setSeats(seats.filter((_, i) => i !== active));
    setActive(Math.max(0, active - 1));
  };
  const changeTotal = (total: number) => {
    setTotalPlayers(total);
    setSeats(seats.slice(0, total));
    setActive(Math.min(active, total - 1));
  };

  const start = () => {
    const pick = (s: Seat) => ({
      name: seatName(s).trim() || navigatorForNation(s.nation)!.name,
      nation: s.nation,
    });
    if (mode) gameController.newGame(createNationRoster(seats.map(pick), { difficulty, totalPlayers }), { ...mode.config, battleMode });
    else gameController.newCampaign({ stage: stageId, navigator: pick(campaignSeat) }, battleMode);
  };

  return (
    <div className="panel setup">
      {onBack && <button onClick={onBack}>{t('Back to title', '返回首页')}</button>}
      <LanguageSwitch />
      <h1>{t('Happy Voyage', '欢乐大航海')}</h1>
      <p className="subtitle">{t('Seven Seas Domination', '七海霸权')}</p>
      <p>
        {mode ? t('Spin the compass, sail the route and plant your flag on new lands. Rivals pay you a toll or attack when they land on your colonies. To win, {goal}. Navigators take turns in seat order, skipping eliminated players. Final wealth is cash plus 75% of colony costs.',
          '转动罗盘，沿航线前进，在新大陆插上你的旗帜。对手停在你的殖民地时，要向你缴纳过路费或发动攻击。获胜条件：{goal}。航海家按座位顺序轮流行动，跳过已破产的玩家。最终财富为现金加上殖民地成本的 75%。',
          { goal: l(winConditionTx(mode.config, DEFAULT_ISLAND_COUNT)) })
          : t('Take on the king’s missions in three standalone campaign stages. Finish every mission in a stage to win.', '在三个独立的战役关卡中接受国王的使命。完成一个关卡的全部使命即可获胜。')}
      </p>

      {mode && <div className="field seats" role="group" aria-labelledby="seats-label">
        <span id="seats-label">{t('Players on this device', '本机玩家')}</span>
        <div className="seat-count" role="group" aria-label={l(tx('Total players', '玩家总数'))}>
          <span>{l(tx('Total players', '玩家总数'))}</span>
          <button aria-label={l(tx('Decrease total players', '减少玩家总数'))} disabled={totalPlayers <= 2} onClick={() => changeTotal(totalPlayers - 1)}>−</button>
          <strong aria-live="polite">{totalPlayers}</strong>
          <button aria-label={l(tx('Increase total players', '增加玩家总数'))} disabled={totalPlayers >= NATIONS.length} onClick={() => changeTotal(totalPlayers + 1)}>+</button>
        </div>
        <small className="nation-note">{l(tx('{humans} humans + {ai} AI rivals', '{humans} 位人类玩家 + {ai} 位电脑对手', { humans: seats.length, ai: totalPlayers - seats.length }))}</small>
        <div className="seat-count">
          <button aria-label={t('Remove player', '移除玩家')} disabled={!multi} onClick={removeSeat}>−</button>
          <strong aria-live="polite">{seats.length}</strong>
          <button aria-label={t('Add player', '添加玩家')} disabled={seats.length >= Math.min(humanLimit, totalPlayers)} onClick={addSeat}>+</button>
          <small className="nation-note">{t('Up to {n} people take turns; pass the device when prompted.', '最多 {n} 人轮流操作；提示时请传递设备。', { n: humanLimit })}</small>
        </div>
        {multi && (
          <div className="choices" role="tablist" aria-label={t('Seat to edit', '要编辑的座位')}>
            {seats.map((s, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === active}
                className={i === active ? 'chip selected' : 'chip'}
                style={{ borderColor: cssColor(NATIONS.find((n) => n.name === s.nation)!.color) }}
                onClick={() => setActive(i)}
              >
                P{i + 1} · {seatLabel(s, locale)} · {nationName(s.nation, locale)}
              </button>
            ))}
          </div>
        )}
      </div>}

      <label className="setup-name">
        {multi ? t('Player {n} navigator name', '玩家 {n} 航海家名字', { n: active + 1 }) : t('Navigator name', '航海家名字')}
        <input value={seatLabel(seat, locale)} maxLength={16} onChange={(e) => update({ customName: e.target.value })} />
      </label>

      <div className="field nations" role="group" aria-labelledby="nation-label">
        <span id="nation-label">{multi ? t('Player {n} nation', '玩家 {n} 国家', { n: active + 1 }) : t('Nation', '国家')}</span>
        <div className="choices">
          {NATIONS.map((n) => {
            const owner = takenBy(n.name);
            return (
              <button
                key={n.name}
                className={n.name === seat.nation ? 'chip selected' : 'chip'}
                aria-pressed={n.name === seat.nation}
                disabled={owner >= 0}
                title={owner >= 0 ? t('Taken by P{n}', '已被 P{n} 选择', { n: owner + 1 }) : undefined}
                style={{ borderColor: cssColor(n.color) }}
                onClick={() => update({ nation: n.name })}
              >
                <NavigatorPortrait navigator={navigatorForNation(n.name)!.id} color={n.color} size={24} />
                {nationName(n.name, locale)}
                {owner >= 0 && <small> (P{owner + 1})</small>}
              </button>
            );
          })}
        </div>
        <NavigatorCard navigator={navigator} color={color} />
        <small className="nation-note">
          {multi ? t('{n} players start at their home ports.', '{n} 位玩家从各自的母港出发。', { n: seats.length }) : t('Start at {nation} Port.', '从{nation}港出发。', { nation: nationName(seat.nation, locale) })}
          {mode && l(tx(' {n} nations are AI rivals.', ' {n} 个国家由电脑对手控制。', { n: totalPlayers - seats.length }))}
        </small>
      </div>

      {mode && <label className="setup-difficulty">
        {t('Rival difficulty', '对手难度')}
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as AIDifficulty)}>
          <option value="easy">{t('Easy', '简单')}</option>
          <option value="normal">{t('Normal', '普通')}</option>
          <option value="hard">{t('Hard', '困难')}</option>
        </select>
        <small className="nation-note">{t('Changes rival decisions, not starting resources or rules.', '只改变对手的决策，不改变初始资源或规则。')}</small>
      </label>}

      <div className="field modes" role="group" aria-labelledby="mode-label">
        <span id="mode-label">{t('Game mode', '游戏模式')}</span>
        <div className="choices">
          {GAME_MODES.map((m) => (
            <button key={m.id} className={m.id === modeId ? 'chip selected' : 'chip'} aria-pressed={m.id === modeId} onClick={() => setModeId(m.id)}>
              {modeText(m.id, locale).name}
            </button>
          ))}
          <button className={modeId === 'campaign' ? 'chip selected' : 'chip'} aria-pressed={modeId === 'campaign'} onClick={() => setModeId('campaign')}>
            {t('Campaign', '战役')}
          </button>
        </div>
        {mode ? <small className="nation-note">{modeText(mode.id, locale).description}</small> : (
          <>
            <label>
              {t('Campaign stage', '战役关卡')}
              <select value={stageId} onChange={(e) => setStageId(e.target.value as CampaignStageId)}>
                {CAMPAIGN_STAGES.map((candidate, index) => <option key={candidate.id} value={candidate.id}>{index + 1}. {stageText(candidate.id, locale).name}</option>)}
              </select>
            </label>
            <small className="nation-note">{stageText(stage.id, locale).briefing}</small>
            <small className="nation-note">{t(`{n} {d} ${stage.rivals === 1 ? 'rival' : 'rivals'}`, '{n} 名{d}对手', { n: stage.rivals, d: locale === 'zh' ? { easy: '简单', normal: '普通', hard: '困难' }[stage.difficulty] : stage.difficulty })} · {hasRoundLimit(stage.config) ? t('{n} rounds', '{n} 回合', { n: stage.config.maxRounds }) : t('No round limit', '不限回合')} · {t('Start with Navigation.', '开局持有「导航」。')}</small>
          </>
        )}
      </div>

      <label className="field">
        {t('Battle mode', '海战方式')}
        <select aria-label={t('Battle mode', '海战方式')} value={battleMode} onChange={(e) => setBattleMode(e.target.value as 'realtime' | 'auto')}>
          <option value="realtime">{t('Command', '亲自指挥')}</option>
          <option value="auto">{t('Auto-resolve', '自动结算')}</option>
        </select>
      </label>
      <div className="setup-rules">
        <button onClick={onRules}>{t('How to play', '玩法说明')}</button>
        {paletteToggle}
      </div>
      <SpeedControl />
      <SoundControl />
      <ShortcutLegend />
      <button className="primary big" onClick={start}>
        {t('Set sail', '扬帆起航')}
      </button>
      <button onClick={() => gameController.openOnline()}>{t('Host online room', '创建在线房间')}</button>
    </div>
  );
}
