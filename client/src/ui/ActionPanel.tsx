import { GAMEPLAY_TUNING } from '@happy-voyage/shared';
import { BUILDINGS, buildingLevel, nextBuildingCost, colonyIncome, colonyToll, colonyDefenders, COMBAT, forecastColonyBattle, GameView, isEliminated, tollDue, SHIP_RECIPES, STRATEGIES, STRATEGY_RULES, strategyTarget, type StrategyId, type BuildingKind, type GameState, type ShipType } from '@happy-voyage/shared';
import { gameController } from '../game/GameController';
import { ShipMarketPanel } from './ShipMarketPanel';
import { ColonyGoods } from './ColonyGoods';
import { Compass } from './Compass';
import { ShortcutLegend } from './ShortcutLegend';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TransferPanel } from './TransferPanel';
import { SeaChoicePanel } from './SeaChoicePanel';
import { CAMPAIGN_STAGES, SPIN_COMPASS_LABEL, buildingDescription, buildingName, campaignStage, chartIdentity, defaultBattleDeployment, goodName, nationName, nodeName, playerName, shipName, shipTypeName, stageText, strategyText } from '@happy-voyage/shared';
import { useT } from '../i18n';
import { NavigatorPortrait } from './NavigatorPortrait';
import { seatTag } from './seats';
import { StatTooltip } from './StatTooltip';
import { EventBus } from '../game/EventBus';
import { RetreatThresholdSelector } from './RetreatThresholdSelector';
import { StrategyArt } from './StrategyArt';
import './strategy-cards.css';

const BUILDING_SIZES = { en: ['None', 'Small', 'Medium', 'Large'], zh: ['无', '小型', '中型', '大型'] };

/** What the human can do right now: spin, claim or decline, or start over. */
export function ActionPanel({ state, colorBlind = false, strategyHost, expandStrategies }: {
  state: GameState;
  colorBlind?: boolean;
  strategyHost?: HTMLElement | null;
  expandStrategies?: boolean;
}) {
  const { t, l, locale } = useT();
  const name = (p: { name: string; navigator?: string }) => playerName(p, locale);
  const at = (id: number) => nodeName(state.map[id], locale);
  const claimNames = (claim: { name: string; island: string; playerId?: number; nodeId?: number }) => ({
    p: claim.playerId === undefined ? claim.name : name(state.players[claim.playerId]), n: claim.nodeId === undefined ? claim.island : at(claim.nodeId) });
  const lastLog = () => { const text = state.logText?.length === state.log.length ? state.logText.at(-1) : undefined; return text ? l(text, state) : state.log.at(-1) ?? ''; };
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [destination, setDestination] = useState(state.map[0].id);
  const [colonyDestination, setColonyDestination] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [targets, setTargets] = useState<Partial<Record<StrategyId, number>>>({});
  const player = state.players[state.currentPlayer];
  const room = gameController.room;
  const defeatedHumans = state.players.filter((p) => p.fleetLost && (room ? p.id === gameController.viewerId : !p.isAI));
  const fleetDefeat = defeatedHumans.map((p) => (
    <p key={p.id} className="headline loss" role="status">
      {t('Defeat for {p}: no ships remain in their sailing fleet.', '{p} 的航行舰队已无船只，航程失败。', { p: name(p) })}
    </p>
  ));
  const atHelm = !player.isAI && (!room || gameController.canHelm);
  const battlePrompt = atHelm && state.phase === 'awaitingToll'
    ? `${state.round}:${player.id}:${player.position}:${state.phase}` : null;
  const [battleChoice, setBattleChoice] = useState<{ prompt: string; ids: number[] }>();
  const eligible = battlePrompt ? player.fleet.filter((ship) => ship.durability > 0) : [];
  const selected = !battlePrompt ? [] : battleChoice?.prompt === battlePrompt
    ? eligible.filter((ship) => battleChoice.ids.includes(ship.id))
    : defaultBattleDeployment(eligible);
  const shipIds = selected.map((ship) => ship.id);
  const canFight = !!battlePrompt && shipIds.length > 0;
  useEffect(() => { if (!battlePrompt) setBattleChoice(undefined); }, [battlePrompt]);
  useEffect(() => {
    if (!canFight) return;
    const fight = () => gameController.fight(shipIds);
    EventBus.on('fight-requested', fight);
    return () => { EventBus.off('fight-requested', fight); };
  }, [canFight, shipIds]);
  const deployment = (
    <fieldset className="battle-deployment">
      <legend>{t('Choose ships for battle', '选择出阵船只')} · {shipIds.length}/{COMBAT.deploymentLimit}</legend>
      {eligible.map((ship) => {
        const checked = shipIds.includes(ship.id);
        return <label key={ship.id}>
          <input type="checkbox" checked={checked} disabled={!checked && shipIds.length >= COMBAT.deploymentLimit}
            onChange={() => battlePrompt && setBattleChoice({ prompt: battlePrompt, ids: checked ? shipIds.filter((id) => id !== ship.id) : [...shipIds, ship.id] })} />
          <span>{shipName(ship.name, locale)}{ship.signature && ` · ${shipTypeName(ship.type, locale)}`} · {t('{d}/{max} durability', '耐久 {d}/{max}', { d: ship.durability, max: ship.maxDurability })}</span>
        </label>;
      })}
    </fieldset>
  );
  const fightButton = <button disabled={!canFight} onClick={() => gameController.fight(shipIds)}>{t('Fight', '开战')} <kbd>F</kbd></button>;
  const canPreview = atHelm && state.phase === 'awaitingSpin' && player.strategies.includes('navigate') && !state.strategyUsed;
  useEffect(() => {
    EventBus.emit('navigate-preview', previewing && canPreview ? { playerId: player.id, nodeId: destination } : null);
    return () => { EventBus.emit('navigate-preview', null); };
  }, [previewing, canPreview, player.id, destination]);
  const spinning = state.phase === 'spinning';
  const spinId = gameController.spinId;
  const summary = atHelm && state.phase === 'awaitingSpin' ? gameController.feedback.summary : null;
  const gold = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value)}${t('g', ' 金币')}`;
  const headline = gameController.headline;

  const handoff = gameController.awaitingHandoff ? player : null;
  if (handoff && state.phase !== 'gameOver') {
    return (
      <div className="panel actions handoff" role="dialog" aria-label={t('Pass the device', '传递设备')}>
        {handoff.navigator && <NavigatorPortrait navigator={handoff.navigator} color={chartIdentity(handoff, colorBlind).color} size={64} />}
        {gameController.handoffNote && (
          <div className={`headline ${gameController.handoffNote.tone}`}>
            {name(state.players[gameController.handoffNote.playerId])}{t(': ', '：')}{l(gameController.handoffNote.message, state)}
          </div>
        )}
        <h2>{t('Pass the device to {p}', '请把设备交给 {p}', { p: name(handoff) })}</h2>
        <p>{seatTag(state.players, handoff)} · {handoff.nation ? nationName(handoff.nation, locale) : t('Navigator', '航海家')} · {t('Round {r}', '第 {r} 回合', { r: state.round })}</p>
        <button className="primary big" onClick={() => gameController.confirmHandoff()}>
          {t('I’m {p}, take the helm', '我是 {p}，接掌船舵', { p: name(handoff) })} <kbd>Space / Enter</kbd>
        </button>
      </div>
    );
  }

  let body;
  if (state.phase === 'gameOver' && state.campaign) {
    const stage = campaignStage(state.campaign.stage);
    const completed = state.campaign.status === 'completed';
    body = (
      <div role="status">
        <h2>{completed ? t('Stage complete: {s}', '关卡完成：{s}', { s: stageText(stage.id, locale).name }) : t('Stage failed: {s}', '关卡失败：{s}', { s: stageText(stage.id, locale).name })}</h2>
        <p>{completed ? t('You completed every mission for the crown.', '你为王室完成了全部使命。') : lastLog()}</p>
        <div className="row">
          {completed && stage.id !== CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1].id &&
            <button className="primary" onClick={() => gameController.nextCampaignStage()}>{t('Next stage', '下一关')}</button>}
          <button onClick={() => gameController.quit()}>{t('New voyage', '新的航程')} <kbd>Enter / Space</kbd></button>
        </div>
      </div>
    );
  } else if (state.phase === 'gameOver') {
    const winner = state.winner === null ? null : state.players[state.winner];
    const flag = winner?.nation ? nationName(winner.nation, locale) : winner ? name(winner) : '';
    const otherOnlineWinner = room && winner?.id !== gameController.viewerId;
    body = (
      <>
        {!winner ? <h2>{t('Voyage ended', '航程结束')}</h2> : state.victory === 'everyContinent' ? (
          <div className="victory-screen" role="status">
            <div className="victory-flag" aria-hidden="true">⚑</div>
            <h2>{winner.isAI || otherOnlineWinner ? t('{p} rules the Seven Seas.', '{p} 称霸七海。', { p: name(winner) }) : !room && gameController.humanCount > 1 ? t('Victory for {p}! Every new continent flies your flag.', '{p} 获胜！每块新大陆都飘扬着你的旗帜。', { p: name(winner) }) : t('Victory! Every new continent flies your flag.', '胜利！每块新大陆都飘扬着你的旗帜。')}</h2>
            <p className="victory-count">{t('All {n} new continents are colonies of {flag}.', '全部 {n} 块新大陆都是{flag}的殖民地。', { n: state.config.islandsToWin, flag })}</p>
          </div>
        ) : (
          <h2>{winner.isAI || otherOnlineWinner ? t('{p} wins the seas.', '{p} 赢得了大海。', { p: name(winner) }) : !room && gameController.humanCount > 1 ? t('Victory for {p}! The crown celebrates you.', '{p} 获胜！王室为你庆贺。', { p: name(winner) }) : t('Victory! The crown celebrates you.', '胜利！王室为你庆贺。')}</h2>
        )}
        <p>{lastLog()}</p>
        {fleetDefeat}
        <table className="standings">
          <caption>{t('Final standings · winner first, then afloat navigators by net worth', '最终排名 · 胜者优先，其余仍在海上的航海家按身家排序')}</caption>
          <thead><tr><th>{t('Navigator', '航海家')}</th><th><StatTooltip stat="gold">{t('Gold', '金币')}</StatTooltip></th><th><StatTooltip stat="islands">{t('Islands', '岛屿')}</StatTooltip></th><th><StatTooltip stat="netWorth">{t('Net worth', '身家')}</StatTooltip></th><th>{t('Status', '状态')}</th></tr></thead>
          <tbody>{state.players.map((p) => ({
            ...p,
            islands: gameController.islandsOwnedBy(p.id),
            worth: gameController.netWorth(p.id),
          })).sort((a, b) => Number(b.id === state.winner) - Number(a.id === state.winner)
            || Number(isEliminated(a)) - Number(isEliminated(b)) || b.worth - a.worth || a.id - b.id).map((p) => (
            <tr key={p.id}><th>{name(p)}{!p.isAI && ` (${seatTag(state.players, p)})`}</th><td>{p.gold}{t('g', ' 金币')}</td><td>{p.islands}</td><td>{p.worth}{t('g', ' 金币')}</td><td>{p.fleetLost ? t('Fleet lost', '舰队覆没') : p.bankrupt ? t('Bankrupt', '破产') : p.id === state.winner ? t('Winner', '胜者') : t('Afloat', '在航')}</td></tr>
          ))}</tbody>
        </table>
        <button className="primary" onClick={() => gameController.quit()}>
          {t('New voyage', '新的航程')} <kbd>Enter / Space</kbd>
        </button>
      </>
    );
  } else if (spinning) {
    body = <p className="waiting">{atHelm ? t('Your compass is spinning.', '你的罗盘正在转动。') : t('{p} spins the compass.', '{p} 正在转动罗盘。', { p: name(player) })}</p>;
  } else if (player.isAI) {
    body = <p className="waiting">{t('{p} is at the helm…', '{p} 正在掌舵……', { p: name(player) })}</p>;
  } else if (!atHelm) {
    const connected = room?.lobby?.seats.find((seat) => seat.nation === player.nation)?.connected;
    body = <p className="waiting">{connected === false ? t('Waiting for {p} to reconnect…', '正在等待 {p} 重新连接……', { p: name(player) }) : t('{p} is at the helm…', '{p} 正在掌舵……', { p: name(player) })}</p>;
  } else if (state.phase === 'awaitingSpin') {
    const colonies = new GameView(state).colonyReturnTargets();
    const returnTo = colonies.find((node) => node.id === colonyDestination) ?? colonies[0];
    body = (
      <>
        <p>{t('Your turn, {p}.', '轮到你了，{p}。', { p: name(player) })}</p>
        <button className="primary big" onClick={() => gameController.spinCompass()}>
          {l(SPIN_COMPASS_LABEL)} <kbd>Space / Enter</kbd>
        </button>
        {returnTo && (
          <div className="row">
            {colonies.length > 1 && <label>{t('Colony destination', '殖民地目的地')} <select value={returnTo.id} onChange={(e) => setColonyDestination(Number(e.target.value))}>
              {colonies.map((node) => <option key={node.id} value={node.id}>{at(node.id)}</option>)}
            </select></label>}
            <button onClick={() => gameController.returnToColony(returnTo.id)}>
              {t('Return to {n}', '返回{n}', { n: at(returnTo.id) })}
            </button>
            <small>{t('Instead of spinning; once every {n} rounds.', '代替转动罗盘；每 {n} 回合可用一次。', { n: GAMEPLAY_TUNING.economy.colonyReturnCooldown })}</small>
          </div>
        )}
      </>
    );
  } else if (state.phase === 'awaitingMerchant' || state.phase === 'awaitingWyvern') {
    body = <SeaChoicePanel key={`${player.id}:${state.phase}`} state={state} />;
  } else if (state.phase === 'awaitingBuild') {
    const nodeId = player.position;
    const yardLevel = buildingLevel(state, nodeId, 'shipyard');
    body = (
      <>
        <h2>{t('Build at {n}', '在{n}建设', { n: at(nodeId) })}</h2>
        <p>{t('Your colony', '你的殖民地')} · <StatTooltip stat="toll">{t('Toll {g}g', '过路费 {g} 金币', { g: colonyToll(state, nodeId) })}</StatTooltip> · <StatTooltip stat="gold">{t('Treasury {g}g', '金库 {g} 金币', { g: player.gold })}</StatTooltip></p>
        <p>{t('Building income: {g}g per round', '建筑收入：每轮 {g} 金币', { g: colonyIncome(state, nodeId) })}</p>
        <ColonyGoods state={state} nodeId={nodeId} />
        <button className="primary transfer-entry" onClick={() => setTransfersOpen(true)}>
          <strong>{t('Ships & cargo transfer', '船只与资源调度')}</strong>
          <small>{t('Dock or board ships · load or unload goods', '停靠或归队船只 · 装卸货物')}</small>
        </button>
        {(Object.keys(BUILDINGS) as BuildingKind[]).map((kind) => {
          const level = buildingLevel(state, nodeId, kind);
          const cost = nextBuildingCost(state, nodeId, kind);
          return (
            <div className="building-option" key={kind}>
              <div><strong>{buildingName(kind, locale)}</strong> · <StatTooltip stat="buildingLevel">{BUILDING_SIZES[locale][level]}</StatTooltip></div>
              <small>{buildingDescription(kind, locale)}</small>
              <button disabled={!gameController.canBuild(kind)} onClick={() => gameController.build(kind)}>
                {cost === null ? t('Max level', '已达最高级') : level ? t('Upgrade ({g}g)', '升级（{g} 金币）', { g: cost }) : t('Build ({g}g)', '建造（{g} 金币）', { g: cost })}
              </button>
            </div>
          );
        })}
        <section aria-labelledby="shipbuilding-heading">
          <h3 id="shipbuilding-heading">{t('Shipbuilding', '造船')} · {t('Fleet {n}/{max}', '舰队 {n}/{max}', { n: player.fleet.length, max: GAMEPLAY_TUNING.ships.maxFleetSize })}</h3>
          {player.fleet.length >= GAMEPLAY_TUNING.ships.maxFleetSize && <p>{t('New ships stay at this colony’s shipyard.', '新船留在本殖民地的船坞。')}</p>}
          {yardLevel === 0 ? <p>{t('Build a shipyard to launch ships.', '建造造船厂后才能造船。')}</p> :
            (Object.keys(SHIP_RECIPES) as ShipType[]).map((type) => {
              const recipe = SHIP_RECIPES[type];
              const canBuild = gameController.canBuildShip(type);
              return (
                <div className="building-option" key={type}>
                  <div><strong>{shipTypeName(type, locale)}</strong> · {recipe.lumber} {goodName('lumber', locale)} · {recipe.iron} {goodName('iron', locale)}</div>
                  {!canBuild && <small>{yardLevel < recipe.yardLevel
                    ? t('Requires a {size} shipyard.', '需要{size}造船厂。', { size: locale === 'zh' ? BUILDING_SIZES.zh[recipe.yardLevel] : BUILDING_SIZES.en[recipe.yardLevel].toLowerCase() })
                    : t('Not enough materials.', '材料不足。')}</small>}
                  <button disabled={!canBuild} onClick={() => gameController.buildShip(type)}>
                    {t('Build {s}', '建造{s}', { s: shipTypeName(type, locale) })}
                  </button>
                </div>
              );
            })}
        </section>
        <ShipMarketPanel state={state} />
        <button className="primary" onClick={() => gameController.finishBuilding()}>{t('Done', '完成')} <kbd>D / Esc</kbd></button>
      </>
    );
  } else if (state.phase === 'awaitingToll') {
    const island = state.map[player.position];
    const { ships, owner, fromFleet } = colonyDefenders(state, island.id);
    const defenders = defaultBattleDeployment(ships);
    const firepower = (ships: { firepower: number }[]) => ships.reduce((sum, ship) => sum + ship.firepower, 0);
    const hull = (ships: { durability: number }[]) => ships.reduce((sum, ship) => sum + ship.durability, 0);
    const forecast = canFight ? (locale === 'zh' ? { victory: '可能获胜', defeat: '可能战败', draw: '可能平局' } : { victory: 'likely victory', defeat: 'likely defeat', draw: 'likely draw' })[forecastColonyBattle(state, player, shipIds)] : null;
    body = (
      <>
        <h2>{t("{o}'s colony at {n}", '{o} 在{n}的殖民地', { o: name(owner), n: at(island.id) })}</h2>
        <p>{fromFleet ? t("Pay {g}g toll, or open fire on {o}'s fleet?", '缴纳 {g} 金币过路费，还是向 {o} 的舰队开火？', { g: tollDue(state, player, island.id), o: name(owner) })
          : t('Pay {g}g toll, or open fire on the docked ships?', '缴纳 {g} 金币过路费，还是向停靠的船只开火？', { g: tollDue(state, player, island.id) })}</p>
        <p>
          {t('Your deployed ships:', '你的出阵船只：')} <StatTooltip stat="ships">{t('{n} ships', '{n} 艘船', { n: selected.length })}</StatTooltip> · <StatTooltip stat="firepower">{t('{f} firepower', '火力 {f}', { f: firepower(selected) })}</StatTooltip> · <StatTooltip stat="durability">{t('{d} durability', '耐久 {d}', { d: hull(selected) })}</StatTooltip>{t('.', '。')}<br />
          {t('Defenders:', '守军：')} {t('{n} ships', '{n} 艘船', { n: defenders.length })} · <StatTooltip stat="firepower">{t('{f} firepower', '火力 {f}', { f: firepower(defenders) })}</StatTooltip> · <StatTooltip stat="durability">{t('{d} durability', '耐久 {d}', { d: hull(defenders) })}</StatTooltip> {forecast && t('({forecast}).', '（{forecast}）。', { forecast })}
        </p>
        <p>
          {state.config.battleMode === 'realtime'
            ? t('Defeat the defenders within 90 s to take the colony. Either side may concede; retreat is defeat. Defeat costs {g}g double toll; timeout is a draw.',
              '在 90 秒内击败守军即可夺取殖民地。双方均可认输撤退，撤退即战败。战败须缴纳 {g} 金币双倍过路费；超时则平局。', { g: tollDue(state, player, island.id, COMBAT.defeatTollMultiplier) })
            : t('Defeat the defenders within {r} volleys to take the colony. Defeat costs {g}g double toll; a draw sends both fleets home.',
              '在 {r} 轮齐射内击败守军即可夺取殖民地。战败须缴纳 {g} 金币双倍过路费；平局则双方各自归队。', { r: COMBAT.rounds, g: tollDue(state, player, island.id, COMBAT.defeatTollMultiplier) })}
          {' '}{t('Choose the fraction of your starting fleet to lose before withdrawing (rounded up). The flagship also withdraws at 25% durability, except with Fight to the last ship. A lone starting ship always fights to the end.',
            '可选择损失开战舰船的几分之几后撤退（向上取整）。旗舰耐久降至 25% 时也会撤退；选择打到最后一艘则关闭这两项自动撤退。开战时仅有一艘的舰队始终战斗到底。')}
        </p>
        {deployment}
        <RetreatThresholdSelector player={player} />
        <div className="row">
          <button className="primary" onClick={() => gameController.payToll()}>{t('Pay toll', '缴纳过路费')} <kbd>P</kbd></button>
          {fightButton}
        </div>
      </>
    );
  } else {
    body = <p className="waiting">{t('Sailing…', '航行中……')}</p>;
  }

  const strategies = (
    <section aria-label={t('Strategy cards', '谋略卡')}>
      <details className="strategy-cards" open={expandStrategies || undefined} onToggle={(event) => { if (!event.currentTarget.open) setPreviewing(false); }}>
        <summary><span className="strategy-deck-mark" aria-hidden="true">✦</span><span>{t('Strategy cards', '谋略卡')}</span><span className="strategy-hand-count">{player.strategies.length}/{STRATEGY_RULES.handCap}</span></summary>
        <div className="strategy-hand-intro"><span>{t('Your hand', '你的手牌')}</span><small>{t('One card per turn', '每回合限用一张')}</small></div>
        {player.strategies.length === 0 && <div className="strategy-empty"><span aria-hidden="true">✦</span><p>{t('No strategy cards.', '没有谋略卡。')}</p></div>}
        <div className="strategy-hand">
        {player.strategies.map((id, index) => {
          const kind = strategyTarget(id, state.phase);
          const options = kind === 'rival' ? state.players.filter((p) => p.id !== player.id && !isEliminated(p)).map((p) => ({ id: p.id, label: name(p) }))
            : kind === 'rivalColony' ? state.map.filter((n) => gameController.canUseStrategy(id, n.id)).map((n) => ({ id: n.id, label: at(n.id) })) : [];
          const target = kind === 'node' ? destination : kind === 'none' ? undefined : options.some((o) => o.id === targets[id]) ? targets[id] : options[0]?.id;
          const usable = gameController.canUseStrategy(id, target);
          const phases = STRATEGIES[id].phases;
          return <article className={`strategy-card ${usable ? 'is-ready' : ''}`} key={`${id}-${index}`} aria-label={strategyText(id, locale).name}>
          <div className="strategy-card-art"><StrategyArt id={id} /><span className="strategy-card-number" aria-hidden="true">{String(Object.keys(STRATEGIES).indexOf(id) + 1).padStart(2, '0')}</span></div>
          <div className="strategy-card-body">
          <h3>{strategyText(id, locale).name}</h3>
          <small className="strategy-card-timing">{phases.length > 1 ? t('Before spinning · At a rival colony', '转盘前 · 敌方殖民地') : phases.includes('awaitingToll') ? t('At a rival colony', '敌方殖民地') : t('Before spinning', '转盘前')}</small>
          <p className="strategy-card-description">{strategyText(id, locale).description}</p>
          <div className="strategy-card-controls">
          {kind === 'node' && <label>{t('Navigate destination', '导航目的地')} <select className="strategy-destination" value={destination} onFocus={() => setPreviewing(true)} onBlur={() => setPreviewing(false)} onChange={(e) => { setDestination(Number(e.target.value)); setPreviewing(true); }}>
            {state.map.map((node) => <option key={node.id} value={node.id}>{nodeName(node, locale)}</option>)}
          </select></label>}
          {(kind === 'rival' || kind === 'rivalColony') && <label>{t('Target for {s}', '「{s}」的目标', { s: strategyText(id, locale).name })}<select value={target ?? ''} onChange={(e) => setTargets({ ...targets, [id]: Number(e.target.value) })}>
            {options.length === 0 && <option value="">{t('No eligible targets', '没有可选目标')}</option>}
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select></label>}
          <span className={`strategy-card-status ${usable ? 'ready' : ''}`}>{usable ? t('Ready to play', '可以使用') : state.strategyUsed ? t('Card already played this turn', '本回合已使用谋略卡') : t('Not available now', '当前不可使用')}</span>
          <button disabled={!usable} onClick={() => gameController.useStrategy(id, target)}>{t('Use {s}', '使用「{s}」', { s: strategyText(id, locale).name })}</button>
          </div></div>
        </article>;
        })}
        </div>
        {player.knownHoard !== null && <p className="strategy-hoard">{t('Buried hoard: {n}', '埋藏的宝藏：{n}', { n: at(player.knownHoard) })}</p>}
      </details>
    </section>
  );
  return (
    <div className={`panel actions ${state.phase === 'awaitingSpin' || spinning || state.phase === 'moving' ? 'sailing-action' : 'decision-action'}`}>
      {state.phase === 'gameOver' ? body : (
        <div className="action-content">
          {fleetDefeat}
          <Compass
            spinId={spinId}
            result={state.lastSpin}
            multiplier={state.compassMultiplier}
            spinning={spinning}
            duration={gameController.timings.spin}
            onSettled={() => gameController.finishSpin(spinId)}
          />
          <div>{body}</div>
        </div>
      )}
      {gameController.waiting && (
        <button onClick={() => gameController.skipToMyTurn()}>{room ? t('Skip animations', '跳过动画') : gameController.humanCount > 1 ? t('Skip to the next player', '跳到下一位玩家') : t('Skip to my turn', '跳到我的回合')} <kbd>K</kbd></button>
      )}
      {atHelm && state.phase !== 'gameOver' && (strategyHost ? createPortal(strategies, strategyHost) : strategies)}
      <div className="rival-cards">
      <p>{state.players.filter((p) => p.id !== player.id).map((p) => t(`{p}: {n} ${p.strategies.length === 1 ? 'card' : 'cards'}`, '{p}：{n} 张谋略卡', { p: name(p), n: p.strategies.length })).join(' · ')}</p>
      </div>
      {summary && (
        <div className="turn-summary">
          <strong>{gameController.humanCount > 1 ? t('Since your last turn, {p}', '{p}，自你上回合以来', { p: name(player) }) : t('Since your last turn', '自你上回合以来')}</strong>
          {summary.tolls.map((toll, i) => (
            <div key={i} className={toll.direction === 'received' ? 'income' : 'expense'}>
              {toll.direction === 'received' ? t('Toll received: {g} from {p}', '收到过路费：{g}，来自 {p}', { g: gold(toll.amount), p: toll.playerId === undefined ? toll.name : name(state.players[toll.playerId]) }) : t('Toll paid: {g} to {p}', '支付过路费：{g}，付给 {p}', { g: gold(-toll.amount), p: toll.playerId === undefined ? toll.name : name(state.players[toll.playerId]) })}
            </div>
          ))}
          {summary.claims.map((claim, i) => <div key={i}>{claim.captured ? t('{p} defeated your defenders and captured {n}.', '{p} 击败了你的守军，夺取了{n}。', claimNames(claim)) : t('{p} claimed {n}.', '{p} 占领了{n}。', claimNames(claim))}</div>)}
          <div>{t('Net gold:', '金币净变化：')} <strong className={summary.netGold < 0 ? 'expense' : 'income'}>{gold(summary.netGold)}</strong></div>
        </div>
      )}
      <div role="status">
        {headline && (!summary || headline.royal) && state.phase !== 'gameOver' && <div className={`headline ${headline.tone}`}>{l(headline.message, state)}</div>}
      </div>
      <ShortcutLegend />
      {transfersOpen && state.phase === 'awaitingBuild' && atHelm && (
        <TransferPanel state={state} onClose={() => setTransfersOpen(false)} />
      )}
    </div>
  );
}
