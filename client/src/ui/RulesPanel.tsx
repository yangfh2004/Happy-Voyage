import { GAMEPLAY_TUNING } from '@happy-voyage/shared';
import { MenuDialog } from './MenuDialog';
import { useT } from '../i18n';
import { tx } from '@happy-voyage/shared';
import { COMBAT, EVENT_GOLD, LOTTERY, SEA_RULES, DEFAULT_ISLAND_COUNT, hasRoundLimit, winConditionText, winConditionTx, localize, type CampaignState, type GameConfig } from '@happy-voyage/shared';

const TURN_ORDER = tx('Navigators take turns in seat order, skipping eliminated players.', '航海家按座位顺序轮流行动，跳过已失败的玩家。');

export function RulesPanel({ config, islandCount = DEFAULT_ISLAND_COUNT, campaign, onClose }: { config: GameConfig; islandCount?: number; campaign?: CampaignState | null; onClose: () => void }) {
  const { locale } = useT();

  return (
    <MenuDialog className="panel rules" labelledBy="rules-title" onDismiss={onClose}>
        <div className="rules-heading"><h2 id="rules-title">{locale === 'zh' ? '玩法说明' : 'How to play'}</h2><button onClick={onClose}>{locale === 'zh' ? '关闭' : 'Close'}</button></div>
        {locale === 'zh' ? <RulesZh config={config} islandCount={islandCount} campaign={campaign} /> : <>
        <p>Spin the compass and sail <strong>clockwise</strong> by the number of stops it shows. The arrows show the way.</p>
        <p>In command battles, orders to multiple ships keep them in formation at the slowest ship's speed. Individual orders detach ships. Changing formation preserves the selected group's order; arrived or free-fire groups hold position.</p>
        <p><strong>Battle deployment:</strong> Each side can deploy up to {COMBAT.deploymentLimit} ships. Choose the ships you want to send before attacking a colony. Cargo ships stay out by default unless no other ships can fight.</p>
        <dl>
          <dt>⚑ Ten national home ports</dt><dd>Each navigator starts at their nation’s home port. Collect {config.homeSalary}g when passing or landing on your own port. Other ports charge {SEA_RULES.foreignTax}g, paid to their navigator or to the crown if no active navigator represents that nation.</dd>
          <dt><svg width="23" height="23" viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="22" fill="#e6cb75"/><circle cx="23" cy="23" r="16" fill="#79b956"/><circle cx="19" cy="18" r="8" fill="#4c9f50"/></svg> Islands</dt><dd>Your first landing on a neutral island automatically claims it for free. Rivals pay toll or attack your defenders (docked ships, else your fleet). Command battles last up to 90 seconds; auto battles up to three volleys. Defeating defenders takes the colony; attacking defeat costs double toll. Retreat by either side is defeat; timeout is a draw and sends both fleets home. Choose automatic withdrawal after losing 1/4, half (default), or 3/4 of the starting fleet, rounded up with a minimum of one. Fleets starting with 2+ ships also withdraw when the flagship reaches 25% durability. Fight to the last ship disables both automatic triggers and allows the entire fleet to sink. Choose this setting in the pre-battle prompt only; battles without a prompt use your existing setting. The battle banner displays it read-only. AI players and pirates use half; colony defenders use their owner's setting. The gold-trim signature ship is flagship; otherwise use highest maximum durability, ties by lowest id. Ships beyond the selected loss cap survive at 1 durability. A lone starting ship always fights on and can sink. Survivors keep their damage.</dd>
          <dt><span className="rule-icon treasure">$</span> Treasure Shoal</dt><dd>Find +{EVENT_GOLD.treasure.min}–{EVENT_GOLD.treasure.max}g.</dd>
          <dt><span className="rule-icon storm">!</span> Storm Front</dt><dd>Pay {EVENT_GOLD.storm.min}–{EVENT_GOLD.storm.max}g for repairs.</dd>
          <dt><span className="rule-icon treasure">≈</span> Trade Winds</dt><dd>Earn +{EVENT_GOLD.tradeWind.base}g plus {EVENT_GOLD.tradeWind.perColony}g per colony you own.</dd>
        </dl>
        <p><strong>Colony development:</strong> As soon as you claim or capture a colony, you can build and use Ships & cargo transfer to leave ships behind to defend it, just as on a return visit. The transfer screen shows current/max durability for fleet and docked ships, and whether docked ships can be repaired here. Choose Done when ready to leave.</p>
        <p>Buildings pay their owner gold at the end of each round, even without tolls. Each building level recovers its cost in {GAMEPLAY_TUNING.economy.colonyPaybackRounds} rounds if you hold the colony.</p>
        <p><strong>Shipyards:</strong> Build a lumber mill, iron mine, and shipyard at your colony. Each round, the mill and mine add materials to the colony's stockpile. Spend those materials at the yard to build a new ship; upgrade the yard to unlock bigger ships.</p>
        <p><strong>Fleet limit:</strong> At most {GAMEPLAY_TUNING.ships.maxFleetSize} ships can sail with each navigator. Extra ships go to the dock at your current colony or the first colony you own in chart order, even without a shipyard building. If you own none, they’re held in reserve until you gain one. Use Ships &amp; cargo transfer at the colony to board them; dock a sailing ship first if your fleet is full.</p>
        <p><strong>Return to a colony:</strong> At the start of your turn, you can sail directly to one of your other colonies instead of spinning. You can do this once every {GAMEPLAY_TUNING.economy.colonyReturnCooldown} rounds, even before the colony has a shipyard.</p>
        <p><strong>Repair yards:</strong> Fully repair all ships docked at that colony for free at the owner's turn start. Ships sailing in your fleet are not repaired by yards.</p>
        <p>Storms and damaging Bermuda whirlpools remove up to {GAMEPLAY_TUNING.economy.seaHazardDamage} durability per ship, keeping their gold costs. These hazards cannot sink ships. Creature encounters and pirate combat have their own damage rules below. Inspect durability in Fleet.</p>
        <p><strong>Skeleton Island market:</strong> At your own colonies or Skeleton Island, buy one of each used ship per visit: Explorer 180g, Cargo Ship 300g, Warship 450g, all at 60% durability. Sell empty ships for half their used purchase price times their remaining durability fraction. Keep at least one ship. Trading is only available on the landing turn.</p>
        <p><strong>Nightless Island:</strong> Build a collection field at your colony, then load its produce using Ships & cargo transfer when you revisit. Land at Nightless Island to sell the cargo or buy goods for your fleet. Scarce goods cost more, demand shifts each round, storms raise prices for repair materials, and trade winds replenish supply.</p>
        <p><strong>Other special islands:</strong> Treasure runs a lottery: buy up to {LOTTERY.maxPicks} numbers from 1–{LOTTERY.balls} at {LOTTERY.ticketPrice}g each before the {LOTTERY.timerSeconds}s timer runs out, then {LOTTERY.drawn} balls are drawn from the glass jar and matches pay {LOTTERY.payouts.slice(1).map((prize, i) => `${i + 1}: ${prize}g`).join(', ')}; Mist offers a choice of three hermits to duel (take 1–{GAMEPLAY_TUNING.sea.nimMaxTake} stones, last loses; win to learn a strategy); Revival automatically repairs your fleet at 2g per durability point, limited by your gold, with no other bonus; Wind lets you exchange cheap fleet cargo for higher-value native goods (choose one offer or decline); Dragon Snake offers up to three captains: recruit one or decline. Higher military ranks unlock better captains. You can recruit up to three captains, each bringing one or two named ships. Their ships fill open slots in your {GAMEPLAY_TUNING.ships.maxFleetSize}-ship fleet; any extras go to a shipyard at one of your colonies. Recruitment fees depend on the ships: Explorer 180g, Cargo Ship 300g, Warship 450g. Captains grant no passive salary or tax benefits. View your ships and captains in Fleet.</p>
        <p><strong>Living seas:</strong> fight pirates for loot; small monsters damage one ship, while large monsters and destructive turtles can sink ships (never your last). Bermuda currents move you or damage your fleet. Bottles grant gold, a rare prize or repairs; floating cargo grants gold or specialties. Accept or decline a merchant’s premium offer for aboard specialties, and choose any wyvern destination to resolve its landing.</p>
        <p>Sea encounters are random: a 20% chance after sailing to any non-port stop, guaranteed on Open sea event spaces. Blank sea spaces have no port or island; their random encounter can also be sunken treasure salvage. Two roaming pirate ships and one monster trigger when a fleet lands on their space (passing by does not trigger them), before the landing effect, then resurface elsewhere. They move 1–3 stops each round. Only one encounter is rolled per turn. Merchants also sell up to five specialty units at 80% of base value; sell and buy in the same visit, then leave to complete your landing.</p>
        <p>Drag to pan; pinch or scroll to zoom. Use Fit chart for the whole route, or Follow ship to return to the active fleet.</p>
        <p><strong>Foreign port taxes:</strong> If you cannot pay the full tax, pay all your gold, then surrender sailing ships cheapest first at their used resale value (including condition). Cargo stays aboard. Seized ships fill open slots in the host’s {GAMEPLAY_TUNING.ships.maxFleetSize}-ship fleet; any extras go to a shipyard at one of the host’s colonies. If there is no host, the crown takes the ships. Excess ship value is not refunded. Losing your last sailing ship or still owing tax means bankruptcy; docked ships cannot pay tax.</p>
        <p><strong>Stay afloat:</strong> You lose if you go bankrupt (below 0 gold) or have no ships left in your sailing fleet. Your colonies go neutral.</p>
        {campaign ? <p><strong>Win:</strong> Complete all of the king’s missions{hasRoundLimit(config) ? ` by the end of round ${config.maxRounds}` : ''} while staying afloat.</p>
          : <p><strong>Win:</strong> {winConditionText(config, islandCount)}. Classic conquest is the original rule; Quick match and Sprint are shorter modes picked at setup.</p>}
        <p>{localize('en', TURN_ORDER)} Net worth = gold + 75% of each colony's purchase price, rounded down.</p>
        </>}
    </MenuDialog>
  );
}

function RulesZh({ config, islandCount, campaign }: { config: GameConfig; islandCount: number; campaign?: CampaignState | null }) {
  return <>
    <p>转动罗盘，按显示的步数<strong>顺时针</strong>航行。箭头标出了航向。</p>
    <p>亲自指挥时，多船指令会保持队形，以最慢舰船的速度前进；单船指令使该船离队。切换队形会保留所选编队的原指令，抵达目的地或自由开火时原地保持队形。</p>
    <p><strong>出阵船只：</strong>海战双方各最多派出 {COMBAT.deploymentLimit} 艘船。进攻殖民地前可选择出阵船只；除非没有其他船可参战，货船默认不出阵。</p>
    <dl>
      <dt>⚑ 十个国家的母港</dt><dd>每位航海家从本国母港出发。经过或停靠自己的母港时领取 {config.homeSalary} 金币。其他港口收取 {SEA_RULES.foreignTax} 金币税金，交给该国的航海家；若该国没有在场的航海家，则交给王室。</dd>
      <dt><svg width="23" height="23" viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="22" fill="#e6cb75"/><circle cx="23" cy="23" r="16" fill="#79b956"/><circle cx="19" cy="18" r="8" fill="#4c9f50"/></svg> 岛屿</dt><dd>首次抵达中立岛屿即免费占领。对手停靠殖民地须缴纳过路费或攻击守军（优先为停靠船只，否则为舰队）。亲自指挥最多 90 秒，自动结算最多齐射三轮。击败守军即可夺取殖民地，进攻方战败须缴纳双倍过路费。双方均可撤退认输；超时平局则各自归队。可选择损失开战舰船的 1/4、半数（默认）或 3/4 后自动撤退，艘数向上取整且至少为一。开战时有两艘以上的舰队，旗舰耐久降至 25% 时也会自动撤退。选择“打到最后一艘”则关闭这两项自动撤退，可全军覆没。仅在开战前的交战提示中选择；没有提示的战斗沿用已有设置。战场横幅仅显示损失上限，不能更改。电脑玩家与海盗方固定半数；殖民地守军使用岛主设置。金边专属船为旗舰；若无则选耐久上限最高者，同值取编号最小者。超过所选损失上限的船只保留 1 点耐久。开战时仅有一艘船始终战斗到底，可被击沉。幸存船只保留损伤。</dd>
      <dt><span className="rule-icon treasure">$</span> 宝藏浅滩</dt><dd>获得 +{EVENT_GOLD.treasure.min}–{EVENT_GOLD.treasure.max} 金币。</dd>
      <dt><span className="rule-icon storm">!</span> 风暴前线</dt><dd>支付 {EVENT_GOLD.storm.min}–{EVENT_GOLD.storm.max} 金币修理费。</dd>
      <dt><span className="rule-icon treasure">≈</span> 信风</dt><dd>获得 +{EVENT_GOLD.tradeWind.base} 金币，每拥有一块殖民地再加 {EVENT_GOLD.tradeWind.perColony} 金币。</dd>
    </dl>
    <p><strong>殖民地建设：</strong>占领或夺取殖民地后立即进入建设界面，与再次停靠己方殖民地一样，可建造或用“船只与资源调度”留下船只防守。调度界面显示舰队和停靠船只的当前耐久和耐久上限，并提示当地能否维修停靠的船只。准备好后选择“完成”离开。</p>
    <p>每轮结束时，建筑会为岛主带来金币，不需要收取过路费。只要继续持有殖民地，每级建筑 {GAMEPLAY_TUNING.economy.colonyPaybackRounds} 轮即可回本。</p>
    <p><strong>造船厂：</strong>在己方殖民地可以建造木材厂、铁矿厂和造船厂。每回合木材厂和铁矿厂会向殖民地仓库补充材料。在造船厂消耗这些材料即可造船；升级造船厂可解锁更大的船。</p>
    <p><strong>舰队上限：</strong>每位航海家的航行舰队最多 {GAMEPLAY_TUNING.ships.maxFleetSize} 艘船。多出的船留在当地的己方殖民地船坞，或送往海图顺序中的第一座己方殖民地，无需建造船厂。没有殖民地时暂存，获得殖民地后再送往船坞。到当地用“船只与资源调度”取回；舰队已满时，先停靠一艘随行船只。</p>
    <p><strong>返回殖民地：</strong>回合开始时，你可以直接航行到自己所在位置以外的任意一座己方殖民地，不必转动罗盘。即使目的地尚未建造船厂，也可以每 {GAMEPLAY_TUNING.economy.colonyReturnCooldown} 回合使用一次。</p>
    <p><strong>修船厂：</strong>在所有者回合开始时，免费修好停靠在该殖民地的所有船只。随舰队航行的船只不会被修船厂修理。</p>
    <p>风暴和造成损伤的百慕达漩涡会让每艘船最多损失 {GAMEPLAY_TUNING.economy.seaHazardDamage} 点耐久，并照常扣除金币。这些灾难不会让船只沉没。海怪遭遇和海盗战斗另有伤害规则（见下文）。可在“舰队”中查看耐久。</p>
    <p><strong>骷髅岛市场：</strong>在自己的殖民地或骷髅岛，每次造访可各购买一艘二手船：探险船 180 金币、货船 300 金币、战舰 450 金币，耐久均为 60%。空船可以出售，价格为二手价的一半乘以剩余耐久比例。至少保留一艘船。只能在停靠当回合交易。</p>
    <p><strong>不夜岛：</strong>在殖民地建造采集场，再次造访时用“船只与资源调度”装载产出。停靠不夜岛即可出售货物或为舰队购买货物。稀缺的货物更贵，需求每回合变化，风暴会抬高修理材料的价格，信风会补充供应。</p>
    <p><strong>其他特殊岛屿：</strong>金银岛举办彩票：在 {LOTTERY.timerSeconds} 秒倒计时结束前，以每个 {LOTTERY.ticketPrice} 金币购买最多 {LOTTERY.maxPicks} 个 1–{LOTTERY.balls} 的号码，然后从玻璃罐中抽出 {LOTTERY.drawn} 个球，按中奖个数支付 {LOTTERY.payouts.slice(1).map((prize, i) => `${i + 1} 个：${prize} 金币`).join('，')}；迷雾岛可选择三位隐士之一对决（每次拿 1–{GAMEPLAY_TUNING.sea.nimMaxTake} 枚棋子，拿到最后一枚者输；获胜可学到谋略）；复活岛自动修理舰队，每点耐久花费2金币，费用以现有金币为限，没有其他奖励；风之岛可用舰队上的便宜货物与土人交换更值钱的货物（选择一个报价或婉拒）；龙蛇岛最多提供三位船长：招募一位或婉拒。军衔越高，可招募的船长越好。最多可招募三位船长，每位带来一至两艘有名字的船只。这些船先填补航行舰队的空位（最多 {GAMEPLAY_TUNING.ships.maxFleetSize} 艘），多出的船留在己方殖民地船坞。招募费用按船只计算：探险船 180 金币、货船 300 金币、战舰 450 金币。船长不提供薪俸或税金加成。可在“舰队”中查看船只与船长。</p>
    <p><strong>鲜活的海洋：</strong>与海盗作战可获得战利品；小海怪会损伤一艘船，大海怪和破坏力超强的海龟可能击沉船只（但不会击沉你的最后一艘）。百慕达洋流会把你带走或损伤舰队。漂流瓶带来金币、稀有奖品或修理；浮货带来金币或特产。可以接受或拒绝商船对船上特产的高价收购，翼龙可载你飞往任意目的地并结算停靠。</p>
    <p>海上遭遇是随机事件：航行至非港口地点有 20% 的机会发生，海上事件格必定发生。空白海格没有港口或岛屿，随机遭遇也可能是打捞沉没的宝藏。两艘海盗船与一只海怪只在舰队停在所在格时发生遭遇（路过不会发生），随后在别处出现；每轮移动 1–3 站。每回合最多随机遭遇一次，先处理遭遇再结算停靠。商船也以基础价格的 80% 出售最多五单位特产；同次遭遇可以买卖，离开后继续停靠。</p>
    <p>拖动可平移地图；双指缩放或滚轮可缩放。用“查看全图”查看整条航线，或用“跟随船只”回到当前舰队。</p>
    <p><strong>外国港口税金：</strong>如果付不起全部税金，先交出所有金币，再按二手转售价（含船况）从最便宜的船开始交出航行中的船只。货物留在船上。被扣押的船先填补东道主航行舰队的空位（最多 {GAMEPLAY_TUNING.ships.maxFleetSize} 艘），多出的船送往东道主的殖民地船坞。没有东道主时由王室收走。多出的船价不予退还。失去最后一艘航行中的船只或仍欠税金即为破产；停靠的船只不能抵税。</p>
    <p><strong>保持在航：</strong>破产（金币低于 0）或航行舰队已无船只都会导致失败，你的殖民地会恢复中立。</p>
    {campaign ? <p><strong>胜利：</strong>{hasRoundLimit(config) ? `在第 ${config.maxRounds} 回合结束前` : ''}完成国王的全部使命并保持在航。</p>
      : <p><strong>胜利：</strong>{localize('zh', winConditionTx(config, islandCount))}。经典征服是原作规则；快速对局和冲刺赛是开局时可选的较短模式。</p>}
    <p>{localize('zh', TURN_ORDER)}身家 = 金币 + 每块殖民地购买价的 75%（向下取整）。</p>
  </>;
}
