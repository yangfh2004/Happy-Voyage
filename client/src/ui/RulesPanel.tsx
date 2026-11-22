import { useEffect, useRef } from 'react';
import { useT } from '../i18n';
import { tx } from '@happy-voyage/shared';
import { EVENT_GOLD, LOTTERY, NIM_MAX_TAKE, SEA_RULES, SEA_HAZARD_DAMAGE, DEFAULT_ISLAND_COUNT, hasRoundLimit, winConditionText, winConditionTx, localize, type CampaignState, type GameConfig } from '@happy-voyage/shared';

const TURN_ORDER = tx('Navigators take turns in seat order, skipping eliminated players.', '航海家按座位顺序轮流行动，跳过已破产的玩家。');

export function RulesPanel({ config, islandCount = DEFAULT_ISLAND_COUNT, campaign, onClose }: { config: GameConfig; islandCount?: number; campaign?: CampaignState | null; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const { locale } = useT();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') { event.preventDefault(); close.current?.focus(); }
    };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); previous?.focus(); };
  }, [onClose]);

  return (
    <div className="rules-backdrop">
      <section className="panel rules" role="dialog" aria-modal="true" aria-labelledby="rules-title">
        <div className="rules-heading"><h2 id="rules-title">{locale === 'zh' ? '玩法说明' : 'How to play'}</h2><button ref={close} onClick={onClose}>{locale === 'zh' ? '关闭' : 'Close'}</button></div>
        {locale === 'zh' ? <RulesZh config={config} islandCount={islandCount} campaign={campaign} /> : <>
        <p>Spin the compass and sail <strong>clockwise</strong> by the number of stops it shows. The arrows show the way.</p>
        <dl>
          <dt>⚑ Ten national home ports</dt><dd>Each navigator starts at their nation’s home port. Collect {config.homeSalary}g when passing or landing on your own port. Other ports charge {SEA_RULES.foreignTax}g, paid to their navigator or to the crown if no active navigator represents that nation.</dd>
          <dt><svg width="23" height="23" viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="22" fill="#e6cb75"/><circle cx="23" cy="23" r="16" fill="#79b956"/><circle cx="19" cy="18" r="8" fill="#4c9f50"/></svg> Islands</dt><dd>Your first landing on a neutral island automatically claims it for free. Rivals landing on your colonies pay you the listed toll or attack: ships fire up to three volleys; sinking every defender (docked ships, else your fleet) takes the colony, losing every attacker costs double toll, and a draw sends both fleets home.</dd>
          <dt><span className="rule-icon treasure">$</span> Treasure Shoal</dt><dd>Find +{EVENT_GOLD.treasure.min}–{EVENT_GOLD.treasure.max}g.</dd>
          <dt><span className="rule-icon storm">!</span> Storm Front</dt><dd>Pay {EVENT_GOLD.storm.min}–{EVENT_GOLD.storm.max}g for repairs.</dd>
          <dt><span className="rule-icon treasure">≈</span> Trade Winds</dt><dd>Earn +{EVENT_GOLD.tradeWind.base}g plus {EVENT_GOLD.tradeWind.perColony}g per colony you own.</dd>
        </dl>
        <p><strong>Shipyards:</strong> Revisit your colony to build a lumber mill, iron mine, and shipyard. Each round, the mill and mine add materials to the colony's stockpile. Spend those materials at the yard to add a new ship to your fleet; upgrade the yard to unlock bigger ships.</p>
        <p><strong>Repair yards:</strong> Fully repair all ships docked at that colony for free at the owner's turn start. Ships sailing in your fleet are not repaired by yards.</p>
        <p>Storms and damaging Bermuda whirlpools remove up to {SEA_HAZARD_DAMAGE} durability per ship, keeping their gold costs. These hazards cannot sink ships. Creature encounters and pirate combat have their own damage rules below. Inspect durability in Fleet.</p>
        <p><strong>Skeleton Island market:</strong> After tribute or scrap trading, buy one of each used ship per visit: Explorer 180g, Cargo Ship 300g, Warship 450g, all at 60% durability. Sell empty ships for half their used purchase price times their remaining durability fraction. Keep at least one ship. Trading is only available on the landing turn.</p>
        <p><strong>Nightless Island:</strong> Build a collection field at your colony, then load its produce using Transfers when you revisit. Land at Nightless Island to sell the cargo or buy goods for your fleet. Scarce goods cost more, demand shifts each round, storms raise prices for repair materials, and trade winds replenish supply.</p>
        <p><strong>Other special islands:</strong> Treasure runs a lottery: buy up to {LOTTERY.maxPicks} numbers from 1–{LOTTERY.balls} at {LOTTERY.ticketPrice}g each before the {LOTTERY.timerSeconds}s timer runs out, then {LOTTERY.drawn} balls are drawn from the glass jar and matches pay {LOTTERY.payouts.slice(1).map((prize, i) => `${i + 1}: ${prize}g`).join(', ')}; Mist offers a choice of three hermits to duel (take 1–{NIM_MAX_TAKE} stones, last loses; win to learn a strategy); Revival fully repairs your fleet for free, with no other bonus; Wind lets you exchange cheap fleet cargo for higher-value native goods (choose one offer or decline); Dragon Snake offers up to three captains: recruit one or decline. Higher royal ranks unlock better captains. Up to three captains stay aboard, adding home salary or reducing colony tolls and foreign tax. Discounts of the same kind add together, capped at 75%; tax discounts apply after rank benefits. View your captains in Fleet.</p>
        <p><strong>Living seas:</strong> fight pirates for loot; small monsters damage one ship, while large monsters and destructive turtles can sink ships (never your last). Bermuda currents move you or damage your fleet. Bottles grant gold, a rare prize or repairs; floating cargo grants gold or specialties. Accept or decline a merchant’s premium offer for aboard specialties, and choose any wyvern destination to resolve its landing.</p>
        <p>Drag to pan; pinch or scroll to zoom. Use Fit chart for the whole route, or Follow ship to return to the active fleet.</p>
        <p><strong>Foreign port taxes:</strong> If you cannot pay the full tax, pay all your gold, then surrender sailing ships cheapest first at their used resale value (including condition). Cargo stays aboard. Ships join the host’s fleet, or are removed by the crown. Excess ship value is not refunded. Losing your last sailing ship or still owing tax means bankruptcy; docked ships cannot pay tax.</p>
        <p><strong>Stay afloat:</strong> below 0 gold means bankruptcy. Your colonies go neutral.</p>
        {campaign ? <p><strong>Win:</strong> Complete all of the king’s missions{hasRoundLimit(config) ? ` by the end of round ${config.maxRounds}` : ''} without going bankrupt.</p>
          : <p><strong>Win:</strong> {winConditionText(config, islandCount)}. Classic conquest is the original rule; Quick match and Sprint are shorter modes picked at setup.</p>}
        <p>{localize('en', TURN_ORDER)} Net worth = gold + 75% of each colony's purchase price, rounded down.</p>
        </>}
      </section>
    </div>
  );
}

function RulesZh({ config, islandCount, campaign }: { config: GameConfig; islandCount: number; campaign?: CampaignState | null }) {
  return <>
    <p>转动罗盘，按显示的步数<strong>顺时针</strong>航行。箭头标出了航向。</p>
    <dl>
      <dt>⚑ 十个国家的母港</dt><dd>每位航海家从本国母港出发。经过或停靠自己的母港时领取 {config.homeSalary} 金币。其他港口收取 {SEA_RULES.foreignTax} 金币税金，交给该国的航海家；若该国没有在场的航海家，则交给王室。</dd>
      <dt><svg width="23" height="23" viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="22" fill="#e6cb75"/><circle cx="23" cy="23" r="16" fill="#79b956"/><circle cx="19" cy="18" r="8" fill="#4c9f50"/></svg> 岛屿</dt><dd>首次抵达中立岛屿即免费占领。对手停靠你的殖民地时要缴纳标示的过路费或发动攻击：双方最多齐射三轮；击沉所有守军（先是停靠的船只，否则是你的舰队）即可夺取殖民地，进攻方全军覆没须缴纳双倍过路费，平局则双方各自归队。</dd>
      <dt><span className="rule-icon treasure">$</span> 宝藏浅滩</dt><dd>获得 +{EVENT_GOLD.treasure.min}–{EVENT_GOLD.treasure.max} 金币。</dd>
      <dt><span className="rule-icon storm">!</span> 风暴前线</dt><dd>支付 {EVENT_GOLD.storm.min}–{EVENT_GOLD.storm.max} 金币修理费。</dd>
      <dt><span className="rule-icon treasure">≈</span> 信风</dt><dd>获得 +{EVENT_GOLD.tradeWind.base} 金币，每拥有一块殖民地再加 {EVENT_GOLD.tradeWind.perColony} 金币。</dd>
    </dl>
    <p><strong>造船厂：</strong>再次停靠自己的殖民地时，可以建造木材厂、铁矿厂和造船厂。每回合木材厂和铁矿厂会向殖民地仓库补充材料。在造船厂消耗这些材料即可为舰队添一艘新船；升级造船厂可解锁更大的船。</p>
    <p><strong>修船厂：</strong>在所有者回合开始时，免费修好停靠在该殖民地的所有船只。随舰队航行的船只不会被修船厂修理。</p>
    <p>风暴和造成损伤的百慕达漩涡会让每艘船最多损失 {SEA_HAZARD_DAMAGE} 点耐久，并照常扣除金币。这些灾难不会让船只沉没。海怪遭遇和海盗战斗另有伤害规则（见下文）。可在“舰队”中查看耐久。</p>
    <p><strong>骷髅岛市场：</strong>缴纳贡金或出售废料后，每次造访可各购买一艘二手船：探险船 180 金币、货船 300 金币、战舰 450 金币，耐久均为 60%。空船可以出售，价格为二手价的一半乘以剩余耐久比例。至少保留一艘船。只能在停靠当回合交易。</p>
    <p><strong>不夜岛：</strong>在殖民地建造采集场，再次造访时用“调度”装载产出。停靠不夜岛即可出售货物或为舰队购买货物。稀缺的货物更贵，需求每回合变化，风暴会抬高修理材料的价格，信风会补充供应。</p>
    <p><strong>其他特殊岛屿：</strong>金银岛举办彩票：在 {LOTTERY.timerSeconds} 秒倒计时结束前，以每个 {LOTTERY.ticketPrice} 金币购买最多 {LOTTERY.maxPicks} 个 1–{LOTTERY.balls} 的号码，然后从玻璃罐中抽出 {LOTTERY.drawn} 个球，按中奖个数支付 {LOTTERY.payouts.slice(1).map((prize, i) => `${i + 1} 个：${prize} 金币`).join('，')}；迷雾岛可选择三位隐士之一对决（每次拿 1–{NIM_MAX_TAKE} 枚棋子，拿到最后一枚者输；获胜可学到谋略）；复活岛免费完全修复舰队，没有其他奖励；风之岛可用舰队上的便宜货物与土人交换更值钱的货物（选择一个报价或婉拒）；龙蛇岛最多提供三位船长：招募一位或婉拒。王室官阶越高，可招募的船长越好。最多三位船长留在船上，增加母港薪俸或减少殖民地过路费与外国税金。同类折扣可叠加，上限 75%；税金折扣在官阶优惠之后计算。可在“舰队”中查看你的船长。</p>
    <p><strong>鲜活的海洋：</strong>与海盗作战可获得战利品；小海怪会损伤一艘船，大海怪和破坏力超强的海龟可能击沉船只（但不会击沉你的最后一艘）。百慕达洋流会把你带走或损伤舰队。漂流瓶带来金币、稀有奖品或修理；浮货带来金币或特产。可以接受或拒绝商船对船上特产的高价收购，翼龙可载你飞往任意目的地并结算停靠。</p>
    <p>拖动可平移地图；双指缩放或滚轮可缩放。用“查看全图”查看整条航线，或用“跟随船只”回到当前舰队。</p>
    <p><strong>外国港口税金：</strong>如果付不起全部税金，先交出所有金币，再按二手转售价（含船况）从最便宜的船开始交出航行中的船只。货物留在船上。船只并入东道主的舰队，或被王室收走。多出的船价不予退还。失去最后一艘航行中的船只或仍欠税金即为破产；停靠的船只不能抵税。</p>
    <p><strong>保持偿付能力：</strong>金币低于 0 即为破产，你的殖民地会恢复中立。</p>
    {campaign ? <p><strong>胜利：</strong>{hasRoundLimit(config) ? `在第 ${config.maxRounds} 回合结束前` : ''}完成国王的全部使命且不破产。</p>
      : <p><strong>胜利：</strong>{localize('zh', winConditionTx(config, islandCount))}。经典征服是原作规则；快速对局和冲刺赛是开局时可选的较短模式。</p>}
    <p>{localize('zh', TURN_ORDER)}身家 = 金币 + 每块殖民地购买价的 75%（向下取整）。</p>
  </>;
}
