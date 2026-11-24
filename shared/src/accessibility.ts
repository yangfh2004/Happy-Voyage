import { tx } from './i18n';

export const SPIN_COMPASS_LABEL = tx('Spin compass', '转动罗盘');

export const TUTORIAL_STEPS = [
  { title: SPIN_COMPASS_LABEL, text: tx('On your turn, select {action} (or press Space or Enter). The result tells your fleet how many stops to sail. What you can do next depends on where you land.', '轮到你时，选择“{action}”（或按空格键或回车键）。结果决定舰队航行几站。抵达地点后，可以采取的行动取决于你停靠的位置。', { action: SPIN_COMPASS_LABEL }) },
  { title: tx('Claim and build colonies', '占领并建设殖民地'), text: tx('The first fleet to land on an unclaimed island claims it for free. After claiming or capturing a colony, build facilities or use Transfers to leave ships behind to defend it. Rivals who land there must pay you a toll or fight.', '首支抵达无主岛屿的舰队免费占领该岛。占领或夺取殖民地后，可以立即修建设施，或用“调度”留下船只防守。对手停靠时必须向你缴纳过路费或开战。') },
  { title: tx('Manage your fleet', '管理舰队'), text: tx('Open Fleet to inspect your ships, cargo and captains. Trade goods at special islands, and keep gold available for purchases and tolls.', '打开“舰队”查看船只、货物和船长。在特殊岛屿交易货物，并留足金币用于购买和支付过路费。') },
  { title: tx('Check your goal', '查看目标'), text: tx('The player panel shows this voyage’s colony goal or king’s missions. Open Rules for the full victory conditions. Select any underlined stat to see what it means.', '玩家面板显示本次航行的殖民地目标或国王使命。打开“规则”查看完整胜利条件。选择有下划线的数据即可查看说明。') },
] as const;

export const STAT_HELP = {
  round: { label: tx('Round', '回合'), description: tx('The round advances once every active navigator has taken a turn.', '所有仍在游戏中的航海家各行动一次后，进入下一回合。') },
  goal: { label: tx('Victory goal', '胜利目标'), description: tx('The colony target or campaign objective for this voyage. Open Rules for the full victory conditions.', '本次航行的殖民地目标或战役目标。打开“规则”查看完整胜利条件。') },
  rank: { label: tx('Military rank', '军衔'), description: tx('The king can promote you when you land at your home port. Higher ranks increase salary, cut foreign taxes, and unlock captains.', '停靠母港时，国王可能为你晋升军衔。军衔越高，薪俸越多，外国税金越低，还能解锁更多可招募的船长。') },
  gold: { label: tx('Gold', '金币'), description: tx('Spendable gold for construction, purchases and paying tolls or taxes.', '可用于建设、购买，以及缴纳过路费或税金的金币。') },
  islands: { label: tx('Colonies', '殖民地'), description: tx('The number of new continents this navigator currently controls.', '这位航海家当前控制的新大陆数量。') },
  ships: { label: tx('Sailing ships', '随行船只'), description: tx('Ships traveling with this fleet. Ships docked at colonies are counted separately.', '随舰队航行的船只。停靠在殖民地的船只另行计算。') },
  captains: { label: tx('Captains aboard', '船上的船长'), description: tx('Recruited captains bring their own ships to join your fleet.', '已招募的船长带着船只加入你的舰队。') },
  durability: { label: tx('Durability', '耐久'), description: tx('The hull strength remaining out of the ship’s maximum. A ship at zero durability sinks.', '船体当前耐久与最大耐久。耐久降至零时，船只沉没。') },
  firepower: { label: tx('Firepower', '火力'), description: tx('The ship’s base cannon damage per volley in a naval battle.', '海战中，这艘船每轮齐射的基础炮击伤害。') },
  cargoCapacity: { label: tx('Cargo capacity', '载货量'), description: tx('Goods loaded in the hold out of the total number of units this ship can carry.', '船舱当前装载量与这艘船最多可携带的货物单位数。') },
  speed: { label: tx('Speed', '航速'), description: tx('The ship’s speed rating. The compass, not ship speed, determines movement in this voyage.', '船只的航速数值。本次航行的移动距离由罗盘决定，而非航速。') },
  crewCapacity: { label: tx('Crew capacity', '船员容量'), description: tx('The ship’s sailor capacity rating. Individual sailors are not tracked in this voyage.', '这艘船可容纳的水手数量。本次航行不追踪单个水手。') },
  netWorth: { label: tx('Net worth', '身家'), description: tx('Your gold plus the end-of-voyage value of your colonies and buildings.', '金币加上航行结束时殖民地和建筑的价值。') },
  toll: { label: tx('Toll', '过路费'), description: tx('The fee owed when a rival lands on a colony.', '对手停靠殖民地时应缴纳的费用。') },
  price: { label: tx('Colony value', '殖民地估值'), description: tx('The island’s value, not a fee to claim it. Claiming a neutral island is free.', '岛屿的估值，不是占领费用。占领无主岛屿免费。') },
  storage: { label: tx('Colony storage', '殖民地库存'), description: tx('Goods stored on the island and available for cargo transfers or shipbuilding.', '储存在岛上、可用于货物调拨或造船的物资。') },
  production: { label: tx('Production per round', '每回合产量'), description: tx('Goods added to this colony’s stockpile by its buildings each round.', '殖民地的建筑每回合为库存增加的货物。') },
  progress: { label: tx('Mission progress', '使命进度'), description: tx('The amount completed out of the target, followed by the gold awarded for finishing this royal mission.', '已完成的数量与目标数量，以及完成这项王室使命可获得的金币。') },
  cards: { label: tx('Strategy cards', '谋略卡'), description: tx('Strategy cards currently held by this navigator. You may use at most one card per turn.', '这位航海家当前持有的谋略卡。每回合最多使用一张。') },
  marketStock: { label: tx('Market stock and cargo', '市场库存与船上货物'), description: tx('Units for sale at this market, followed by units of the selected good already aboard your selected ship.', '市场可出售的数量，以及选定船只上已有的该货物数量。') },
  marketPrice: { label: tx('Market prices', '市场价格'), description: tx('The buy and sell prices for the next unit. Prices can change as stock changes.', '下一单位货物的买入价和卖出价。价格可能随库存变化。') },
  freeHold: { label: tx('Free hold', '剩余舱位'), description: tx('Empty cargo space on the selected ship, measured in units.', '选定船只尚可装载的货物单位数。') },
  lotteryPicks: { label: tx('Lottery picks', '已选彩票号码'), description: tx('Numbers you have bought out of the maximum allowed for this draw.', '本次开奖已购号码数与最多可购号码数。') },
  lotteryOdds: { label: tx('Lottery odds', '彩票中奖概率'), description: tx('The chance of getting exactly this many matches with your current number of picks.', '按当前已选的号码数，恰好命中这么多个号码的概率。') },
  buildingLevel: { label: tx('Building level', '建筑等级'), description: tx('The current size of this facility. Upgrading to a larger facility improves what the colony can produce or build.', '设施当前的规模。升级到更大规模可以提高产量或扩展建造能力。') },
} as const;

export type Stat = keyof typeof STAT_HELP;

const PLAYER_COLORS = [
  0x56b4e9, 0xe69f00, 0xcc79a7, 0xf0e442, 0x009e73,
  0xd55e00, 0x0072b2, 0xffffff, 0xaab4c3, 0xb892ef,
] as const;

export function chartIdentity(player: { id: number; color: number }, colorBlind: boolean) {
  return {
    color: colorBlind ? PLAYER_COLORS[player.id % PLAYER_COLORS.length] : player.color,
    badge: colorBlind ? String(player.id + 1) : null,
  };
}
