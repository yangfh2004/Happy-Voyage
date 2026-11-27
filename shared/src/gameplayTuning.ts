import type { ShipType } from './types';

type NumberRule = { kind: 'number'; value: number; min: number; max: number; integer: boolean; description: string };
type FleetRule = { kind: 'fleet'; value: ShipType[]; description: string };
type Rule = NumberRule | FleetRule;
interface RuleSection { [key: string]: Rule | RuleSection }

const int = (value: number, min: number, max: number, description: string): NumberRule =>
  ({ kind: 'number', value, min, max, integer: true, description });
const ratio = (value: number, min: number, max: number, description: string): NumberRule =>
  ({ kind: 'number', value, min, max, integer: false, description });
const gold = (value: number, description: string) => int(value, 0, 100_000, `${description}（金币）`);
const positive = (value: number, description: string) => int(value, 1, 100_000, description);
const probability = (value: number, description: string) => ratio(value, 0, 1, `${description}（概率，0–1）`);
const fleet: FleetRule = {
  kind: 'fleet', value: ['warship', 'cargo', 'explorer', 'explorer', 'explorer', 'warship', 'warship', 'warship'],
  description: '开局舰队。每项是一艘船，顺序有效；航海家的旗舰替换第一艘同型船。',
};

const schema = {
  ranks: {
    meritPerColony: int(100, 0, 1000, '每块殖民地增加的功绩'),
    meritPerBuildingLevel: int(25, 0, 1000, '每级建筑增加的功绩'),
    goldPerAudienceMerit: gold(2, '非晋升觐见时每点新功绩的赏金'),
    ensign: { salary: gold(0, '少尉薪俸加成'), taxDiscount: probability(0, '少尉外港税减免比例') },
    junior: { merit: int(100, 0, 100_000, '中尉晋升所需功绩'), salary: gold(50, '中尉薪俸加成'), taxDiscount: probability(0.1, '中尉外港税减免比例'), purse: gold(200, '中尉晋升赏金') },
    lieutenant: { merit: int(250, 0, 100_000, '上尉晋升所需功绩'), salary: gold(100, '上尉薪俸加成'), taxDiscount: probability(0.2, '上尉外港税减免比例'), purse: gold(350, '上尉晋升赏金') },
    lieutenantCommander: { merit: int(450, 0, 100_000, '少校晋升所需功绩'), salary: gold(175, '少校薪俸加成'), taxDiscount: probability(0.3, '少校外港税减免比例'), purse: gold(500, '少校晋升赏金') },
    commander: { merit: int(700, 0, 100_000, '中校晋升所需功绩'), salary: gold(250, '中校薪俸加成'), taxDiscount: probability(0.4, '中校外港税减免比例'), purse: gold(700, '中校晋升赏金') },
    captain: { merit: int(1000, 0, 100_000, '上校晋升所需功绩'), salary: gold(350, '上校薪俸加成'), taxDiscount: probability(0.5, '上校外港税减免比例'), purse: gold(1000, '上校晋升赏金') },
  },
  captains: {
    max: int(3, 0, 9, '最多招募的船长人数'),
    offers: int(3, 1, 9, '骷髅岛每次最多提供的船长数'),
    aiReserve: gold(200, '电脑招募船长时保留的金币'),
    ines: { minRank: int(0, 0, 5, '踏潮者伊内丝所需军衔（少尉为 0）'), fee: gold(180, '招募踏潮者伊内丝的费用') },
    rui: { minRank: int(0, 0, 5, '暗礁鲁伊所需军衔（少尉为 0）'), fee: gold(300, '招募暗礁鲁伊的费用') },
    mei: { minRank: int(0, 0, 5, '观星者梅所需军衔（少尉为 0）'), fee: gold(450, '招募观星者梅的费用') },
    gaspar: { minRank: int(1, 0, 5, '银羽加斯帕所需军衔（少尉为 0）'), fee: gold(480, '招募银羽加斯帕的费用') },
    amara: { minRank: int(2, 0, 5, '风镜阿玛拉所需军衔（少尉为 0）'), fee: gold(480, '招募风镜阿玛拉的费用') },
    lin: { minRank: int(2, 0, 5, '丝帆林所需军衔（少尉为 0）'), fee: gold(750, '招募丝帆林的费用') },
    duarte: { minRank: int(3, 0, 5, '赤罗盘杜阿尔特所需军衔（少尉为 0）'), fee: gold(750, '招募赤罗盘杜阿尔特的费用') },
    zahra: { minRank: int(4, 0, 5, '逐曙扎赫拉所需军衔（少尉为 0）'), fee: gold(900, '招募逐曙扎赫拉的费用') },
    leonor: { minRank: int(5, 0, 5, '金海平线莱奥诺尔所需军衔（少尉为 0）'), fee: gold(900, '招募金海平线莱奥诺尔的费用') },
  },
  flagshipBonuses: {
    columbus: { maxDurability: int(20, 0, 500, '哥伦布旗舰增加的耐久'), cargoCapacity: int(20, 0, 500, '哥伦布旗舰增加的货舱（单位）') },
    juliana: { cargoCapacity: int(40, 0, 500, '优莉安娜旗舰增加的货舱（单位）') },
    cook: { maxDurability: int(20, 0, 500, '库克旗舰增加的耐久'), speed: int(1, 0, 20, '库克旗舰增加的航速') },
    magellan: { speed: int(2, 0, 20, '麦哲伦旗舰增加的航速') },
    zhengHe: { cargoCapacity: int(30, 0, 500, '郑和旗舰增加的货舱（单位）'), crewCapacity: int(20, 0, 500, '郑和旗舰增加的船员容量（人）') },
    morgan: { firepower: int(10, 0, 500, '摩根旗舰增加的火力') },
    hasekura: { maxDurability: int(20, 0, 500, '支仓常长旗舰增加的耐久'), firepower: int(5, 0, 500, '支仓常长旗舰增加的火力') },
    behaim: { maxDurability: int(40, 0, 500, '贝海姆旗舰增加的耐久') },
    verrazzano: { speed: int(1, 0, 20, '韦拉扎诺旗舰增加的航速'), cargoCapacity: int(20, 0, 500, '韦拉扎诺旗舰增加的货舱（单位）') },
    yiSunSin: { maxDurability: int(30, 0, 500, '李舜臣旗舰增加的耐久'), firepower: int(8, 0, 500, '李舜臣旗舰增加的火力') },
  },
  starting: {
    gold: gold(3200, '普通对局开局金币'),
    homeSalary: gold(400, '普通对局经过或停靠母港的薪俸'),
    strategies: int(3, 0, 20, '开局谋略牌数量，不超过手牌上限'),
    fleet,
  },
  localSeats: {
    total: int(4, 2, 10, '普通对局的默认总人数'),
    humanLimit: int(6, 1, 10, '普通对局的本机玩家人数上限'),
  },
  pacing: {
    Normal: { ai: int(700, 0, 5000, '普通速度下电脑行动等待（毫秒）'), step: int(200, 0, 5000, '普通速度下逐格航行时间（毫秒）'), spin: int(1400, 0, 5000, '普通速度下罗盘动画时间（毫秒）') },
    Fast: { ai: int(250, 0, 5000, '快速下电脑行动等待（毫秒）'), step: int(70, 0, 5000, '快速下逐格航行时间（毫秒）'), spin: int(500, 0, 5000, '快速下罗盘动画时间（毫秒）') },
  },
  ships: {
    maxFleetSize: int(20, 2, 40, '每位航海家的舰队上限（艘）；至少留出两艘船的容量，才可更换唯一的随行船'),
    usedCondition: ratio(0.6, 0.05, 1, '中古船初始耐久比例'),
    saleMultiplier: ratio(0.5, 0, 1, '中古船卖价折扣，另乘当前耐久比例'),
    warship: { durability: positive(120, '战舰最大耐久'), firepower: positive(30, '战舰火力'), cargo: positive(25, '战舰货舱（单位）'), speed: positive(4, '战舰航速'), crew: positive(60, '战舰船员容量（人）'), usedPrice: gold(450, '中古战舰价格'), yardLevel: int(3, 1, 3, '建造战舰所需船厂等级'), lumber: positive(6, '建造战舰所需木材（单位）'), iron: positive(4, '建造战舰所需铁矿（单位）') },
    cargo: { durability: positive(100, '货船最大耐久'), firepower: positive(8, '货船火力'), cargo: positive(120, '货船货舱（单位）'), speed: positive(3, '货船航速'), crew: positive(30, '货船船员容量（人）'), usedPrice: gold(300, '中古货船价格'), yardLevel: int(2, 1, 3, '建造货船所需船厂等级'), lumber: positive(4, '建造货船所需木材（单位）'), iron: positive(2, '建造货船所需铁矿（单位）') },
    explorer: { durability: positive(80, '探险船最大耐久'), firepower: positive(12, '探险船火力'), cargo: positive(40, '探险船货舱（单位）'), speed: positive(7, '探险船航速'), crew: positive(25, '探险船船员容量（人）'), usedPrice: gold(180, '中古探险船价格'), yardLevel: int(1, 1, 3, '建造探险船所需船厂等级'), lumber: positive(2, '建造探险船所需木材（单位）'), iron: positive(1, '建造探险船所需铁矿（单位）') },
  },
  map: {
    targetSeaSpacing: int(300, 255, 600, '主航线每步的目标距离（地图像素）；短于该值 1.5 倍的航段不加空白海格'),
    colonyBasePrice: gold(100, '新大陆最低定价'),
    colonyPriceIncrease: gold(250, '路线末端相对首块新大陆的定价涨幅'),
    colonyPriceStep: positive(5, '新大陆定价的取整单位（金币）'),
    baseTollRate: ratio(0.35, 0, 5, '基础过路费占殖民地价格的比例'),
    ironYieldMin: int(1, 0, 15, '每级铁矿厂最低产量（单位/轮）'),
    ironYieldVariants: int(3, 1, 15, '相邻岛屿铁矿产量的循环档数'),
    windMinTurns: int(2, 1, 20, '风向持续最少轮数'),
    windExtraTurns: int(2, 0, 20, '风向可额外持续的最多轮数'),
  },
  economy: {
    repairGoldPerPoint: positive(2, '复活岛每点耐久修理费（金币）'),
    seaHazardDamage: int(10, 0, 1000, '海上危险造成的舰船伤害（耐久）'),
    colonyReturnCooldown: int(12, 0, 100, '返回殖民地的冷却（轮）'),
    colonyResaleRate: ratio(0.75, 0, 1, '身家中计入殖民地及建筑投入的比例'),
    buildingTollRate: ratio(0.25, 0, 5, '每级建筑增加的基础过路费比例'),
    colonyPaybackRounds: int(4, 1, 100, '建筑投入分摊为每轮收入的轮数'),
    lumberPerLevel: int(1, 0, 100, '木材厂每级生产（单位/轮）'),
    specialtyPerLevel: int(1, 0, 100, '采集场每级生产（单位/轮）'),
    buildings: {
      lumberMill: { level1: gold(60, '木材厂 1 级造价'), level2: gold(120, '木材厂 2 级造价'), level3: gold(180, '木材厂 3 级造价') },
      ironMine: { level1: gold(80, '铁矿厂 1 级造价'), level2: gold(160, '铁矿厂 2 级造价'), level3: gold(240, '铁矿厂 3 级造价') },
      shipyard: { level1: gold(120, '造船厂 1 级造价'), level2: gold(240, '造船厂 2 级造价'), level3: gold(360, '造船厂 3 级造价') },
      repairYard: { level1: gold(80, '修船厂造价') },
      collectionField: { level1: gold(60, '采集场 1 级造价'), level2: gold(120, '采集场 2 级造价'), level3: gold(180, '采集场 3 级造价') },
    },
  },
  modes: {
    conquest: { islandsToWin: int(Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER, '经典征服的胜利岛屿数，超过地图岛屿数表示全占领'), maxRounds: int(999, 1, 999, '经典征服轮数上限，999 表示不限') },
    quick: { islandsToWin: int(10, 1, 40, '快速对局的胜利岛屿数'), maxRounds: int(50, 1, 999, '快速对局轮数上限，999 表示不限') },
    sprint: { islandsToWin: int(6, 1, 40, '冲刺赛的胜利岛屿数'), maxRounds: int(20, 1, 999, '冲刺赛轮数上限，999 表示不限') },
  },
  campaign: {
    'first-voyage': {
      config: { startingGold: gold(1400, '初航：开局金币'), homeSalary: gold(400, '初航：母港薪俸'), maxRounds: int(999, 1, 999, '初航：轮数上限（999 表示不限）') },
      rivals: int(1, 1, 9, '初航：电脑对手人数'),
      foundColony: { target: int(1, 1, 40, '初航：建立殖民地次数'), reward: gold(150, '初航：建立殖民地任务奖励') },
      reportHome: { target: int(1, 1, 40, '初航：回港报到次数'), reward: gold(250, '初航：回港报到任务奖励') },
    },
    'merchant-charter': {
      config: { startingGold: gold(1600, '商贸特许：开局金币'), homeSalary: gold(400, '商贸特许：母港薪俸'), maxRounds: int(28, 1, 999, '商贸特许：轮数上限') },
      rivals: int(2, 1, 9, '商贸特许：电脑对手人数'),
      sellSpecialties: { target: int(3, 1, 40, '商贸特许：售出特产（单位）'), reward: gold(200, '商贸特许：售卖任务奖励') },
      buildCollectionField: { target: int(1, 1, 40, '商贸特许：建造采集场次数'), reward: gold(250, '商贸特许：建造任务奖励') },
    },
    'crown-of-the-seas': {
      config: { startingGold: gold(1200, '七海王冠：开局金币'), homeSalary: gold(300, '七海王冠：母港薪俸'), maxRounds: int(20, 1, 999, '七海王冠：轮数上限') },
      rivals: int(3, 1, 9, '七海王冠：电脑对手人数'),
      holdColonies: { target: int(2, 1, 40, '七海王冠：同时持有的殖民地数'), reward: gold(250, '七海王冠：持有殖民地任务奖励') },
      captureColony: { target: int(1, 1, 40, '七海王冠：攻占殖民地次数'), reward: gold(400, '七海王冠：攻占任务奖励') },
    },
  },
  market: {
    basePrice: { lumber: positive(10, '木材基准价（金币）'), iron: positive(14, '铁矿基准价（金币）'), Wine: positive(18, '葡萄酒基准价（金币）'), Sugar: positive(13, '糖基准价（金币）'), Cotton: positive(12, '棉花基准价（金币）'), Timber: positive(15, '优质木材基准价（金币）'), Cocoa: positive(16, '可可基准价（金币）'), Tobacco: positive(17, '烟草基准价（金币）'), Silver: positive(24, '白银基准价（金币）'), Spices: positive(22, '香料基准价（金币）'), Silk: positive(21, '丝绸基准价（金币）'), Tea: positive(19, '茶叶基准价（金币）') },
    normalStock: int(16, 0, 500, '不夜岛各货物的基准库存（单位）'),
    recoveryPerRound: int(2, 0, 500, '每轮库存回归基准的最大数量（单位）'),
    featuredDemand: gold(3, '本轮热销货物加价'),
    repairDemand: gold(4, '风暴后木材和铁矿加价'),
    repairDemandRounds: int(1, 0, 20, '风暴后的维修需求持续至几轮之后'),
    buySpreadRate: ratio(.25, 0, 5, '买价附加价差占基准价的比例'),
    discountCapRate: probability(.5, '供过于求时最大折价比例'),
    premiumCapRate: ratio(1, 0, 5, '供不应求时最大加价比例'),
  },
  colonyMarket: {
    stockPerRound: int(16, 0, 500, '殖民地本地市场每轮特产库存（单位）'),
    foreignSpecialtyPremium: ratio(.5, 0, 5, '本地市场外地特产卖价加成'),
    visitorTaxRate: probability(.1, '非岛主本地市场交易税率'),
  },
  barter: {
    values: { lumber: positive(10, '木材交换估价'), iron: positive(20, '铁矿交换估价'), Cotton: positive(25, '棉花交换估价'), Timber: positive(30, '优质木材交换估价'), Sugar: positive(35, '糖交换估价'), Wine: positive(40, '葡萄酒交换估价'), Cocoa: positive(45, '可可交换估价'), Tobacco: positive(50, '烟草交换估价'), Tea: positive(60, '茶叶交换估价'), Spices: positive(75, '香料交换估价'), Silk: positive(90, '丝绸交换估价'), Silver: positive(100, '白银交换估价') },
    giveValueCap: positive(50, '能用于以物易物的货物估价上限'),
    offers: int(3, 1, 12, '以物易物最多提供的报价数'),
    maxUnits: int(5, 1, 100, '一笔以物易物最多交出的货物（单位）'),
  },
  compass: {
    step2: positive(1, '罗盘走 2 格的权重'), step3: positive(2, '罗盘走 3 格的权重'),
    step4: positive(3, '罗盘走 4 格的权重'), step5: positive(4, '罗盘走 5 格的权重'),
    step6: positive(5, '罗盘走 6 格的权重'), step7: positive(6, '罗盘走 7 格的权重'),
    step8: positive(5, '罗盘走 8 格的权重'), step9: positive(4, '罗盘走 9 格的权重'),
    step10: positive(3, '罗盘走 10 格的权重'), step11: positive(2, '罗盘走 11 格的权重'),
    step12: positive(1, '罗盘走 12 格的权重'),
  },
  combat: {
    deploymentLimit: int(4, 1, 10, '进攻舰队最多出战舰船（艘）'),
    hitChance: probability(0.85, '自动结算炮击命中'),
    rounds: int(3, 1, 50, '自动结算最多交换炮火的轮数'),
    minRoll: ratio(0.75, 0, 5, '自动炮击最低伤害倍数'),
    rollSpread: ratio(0.5, 0, 5, '自动炮击伤害的随机倍数增幅'),
    defeatTollMultiplier: ratio(2, 0, 10, '进攻失败后缴纳的过路费倍数'),
    flagshipRetreat: probability(0.25, '旗舰耐久低于此比例触发撤退'),
    lossFraction: { quarter: probability(.25, '四分之一撤退选项的损失比例'), half: probability(.5, '半数撤退选项的损失比例'), threeQuarters: probability(.75, '四分之三撤退选项的损失比例') },
    cannonballSpeed: int(800, 100, 4000, '即时海战炮弹速度（像素/秒）'),
    realtimeLimit: int(90, 1, 300, '即时海战在未决胜时判平的时限（秒）'),
    movementScale: ratio(16, 1, 50, '即时海战船速到像素/秒的换算倍数'),
    minRealtimeRoll: ratio(.75, 0, 5, '即时炮击最低伤害倍数'),
    realtimeRollSpread: ratio(.5, 0, 5, '即时炮击伤害的随机倍数增幅'),
    baseScatter: int(18, 0, 300, '即时炮击基本散布（像素）'),
    distanceScatter: int(88, 0, 300, '即时炮击每单位相对射程超出半射程的附加散布（像素）'),
    aiDecisionSeconds: int(1, 1, 10, '即时海战电脑指令间隔（秒）'),
    aiRetreatStrength: probability(.35, '困难电脑低于对手此战力比例时撤退'),
    battleStats: {
      warship: { turn: positive(50, '战舰转向（度/秒）'), range: positive(640, '战舰射程（像素）'), reload: ratio(3, .2, 60, '战舰装填（秒）'), radius: int(22, 4, 80, '战舰碰撞半径（像素）') },
      cargo: { turn: positive(45, '货船转向（度/秒）'), range: positive(440, '货船射程（像素）'), reload: ratio(3, .2, 60, '货船装填（秒）'), radius: int(20, 4, 80, '货船碰撞半径（像素）') },
      explorer: { turn: positive(90, '探险船转向（度/秒）'), range: positive(520, '探险船射程（像素）'), reload: ratio(2, .2, 60, '探险船装填（秒）'), radius: int(16, 4, 80, '探险船碰撞半径（像素）') },
    },
  },
  strategies: {
    handCap: int(5, 1, 20, '谋略手牌上限（张）'), hoardGold: gold(200, '埋藏宝藏奖励'),
    inspireMultiplier: ratio(1.25, 0, 10, '激励火力倍数'), bottleChance: probability(.5, '玻璃瓶授予谋略牌'),
    misleadDamage: int(40, 0, 1000, '误导伤害（耐久）'), betrayMaxShips: int(1, 0, 10, '背叛最多获得的舰船（艘）'),
    plunderRate: probability(.1, '劫掠夺取对手金币的比例'), plunderCap: gold(150, '劫掠金币上限'),
    galeDamage: int(15, 0, 1000, '呼风对每艘船的伤害（耐久）'),
    ambushDefenseMultiplier: ratio(.5, 0, 10, '奇袭时自动结算首轮守军火力倍数'),
    ambushSeconds: ratio(4, 0, 30, '奇袭时守军不能开火的时间（秒）'),
    charterPerColony: gold(40, '特许贸易每块殖民地收益'), charterCap: gold(300, '特许贸易金币上限'),
    repairAmount: int(30, 0, 1000, '抢修对每艘船恢复的耐久'),
    tailwindMultiplier: int(2, 1, 5, '顺风罗盘步数倍数'), scorchRemaining: probability(.5, '焚仓后剩余的库存比例'),
  },
  sea: {
    roamingPirates: int(2, 0, 10, '起始游荡海盗数量'),
    roamingMonsters: int(1, 0, 10, '起始游荡小海怪数量'),
    roamerStartDistance: int(3, 0, 15, '游荡遭遇与母港之间的最低航路距离（格）'),
    roamerMaxSteps: int(3, 1, 15, '游荡遭遇每轮移动的最大距离（格）'),
    encounterChance: probability(.2, '触发海上遭遇'), merchantDiscount: ratio(.8, .1, 5, '商船出售货物的折扣倍数'), merchantReserve: gold(500, '电脑与商船交易的保留资金'),
    encounterWeights: { pirates: positive(18, '海盗遭遇权重'), smallMonster: positive(16, '小海怪遭遇权重'), whirlpool: positive(12, '漩涡遭遇权重'), bottle: positive(14, '漂流瓶遭遇权重'), floatingCargo: positive(14, '漂浮货物遭遇权重'), merchant: positive(14, '商船遭遇权重'), wyvern: positive(4, '飞龙遭遇权重'), largeMonster: positive(4, '大海怪遭遇权重'), turtle: positive(4, '海龟遭遇权重') },
    foreignTax: gold(40, '外港基础税'),
    wreckSalvageFee: positive(100, '沉船打捞费用（金币）'),
    nimStones: int(12, 2, 60, '迷雾岛棋局石子总数'), nimPrize: gold(130, '迷雾岛棋局胜利奖励'),
    nimMaxTake: int(3, 1, 12, '迷雾岛每步可取石子的上限'),
    pirates: gold(80, '海盗损失'), pirateLoot: gold(140, '战胜海盗的奖励'),
    pirateDurability: positive(90, '海盗船最大耐久'), pirateFirepower: positive(24, '海盗船火力'),
    smallMonster: gold(30, '小海怪损失'), largeMonster: gold(110, '大海怪损失'),
    smallMonsterDamage: int(12, 0, 1000, '小海怪伤害（耐久）'), largeMonsterDamage: int(55, 0, 1000, '大海怪伤害（耐久）'),
    monsterSinkChance: probability(.35, '海怪击沉舰船'), turtleDamage: int(70, 0, 1000, '海龟伤害（耐久）'),
    whirlpoolLoss: gold(60, '漩涡损失'), whirlpoolSteps: int(4, 1, 30, '漩涡移动步数'),
    whirlpoolDamageChance: probability(.33, '漩涡损坏舰船'), relocationLimit: int(4, 1, 20, '一次航行连续传送上限'),
    bottle: gold(70, '漂流瓶基础奖励'), bottlePrize: gold(600, '漂流瓶大奖'),
    bottlePrizeChance: probability(.1, '漂流瓶中大奖'), bottleRepairChance: probability(.3, '漂流瓶修理舰船'),
    floatingCargo: gold(100, '漂浮货物现金奖励'), cargoGoldChance: probability(.5, '漂浮货物给金币而非货物'),
    cargoUnits: int(4, 1, 100, '漂浮货物数量（单位）'), merchantPremium: ratio(1.5, 0, 10, '商船收购价格倍数'), merchantUnits: int(5, 1, 100, '商船买卖货物数量（单位）'),
    treasure: { min: gold(50, '打捞奖励最低金币'), max: gold(200, '打捞奖励最高金币'), step: positive(50, '打捞奖励步进（金币）') },
    storm: { min: gold(50, '暴风最低损失'), max: gold(100, '暴风最高损失'), step: positive(25, '暴风损失步进（金币）') },
    tradeWind: { base: gold(50, '贸易风基础奖励'), perColony: gold(30, '贸易风每块殖民地额外奖励') },
  },
  ai: {
    easy: { reserve: gold(450, '简单电脑的资金保留'), fleetSize: int(6, 1, 40, '简单电脑的目标舰队（艘）'), development: int(1, 0, 3, '简单电脑的目标建筑等级') },
    normal: { reserve: gold(400, '普通电脑的资金保留'), fleetSize: int(7, 1, 40, '普通电脑的目标舰队（艘）'), development: int(2, 0, 3, '普通电脑的目标建筑等级') },
    hard: { reserve: gold(400, '困难电脑的资金保留'), fleetSize: int(8, 1, 40, '困难电脑的目标舰队（艘）'), development: int(3, 0, 3, '困难电脑的目标建筑等级') },
    lotteryReserve: gold(600, '电脑购买彩票的资金保留'), lotteryPicks: int(3, 0, 5, '电脑购买彩票号码的上限'),
  },
  lottery: {
    balls: int(20, 5, 100, '金银岛号码球总数'), drawn: int(5, 1, 5, '金银岛抽出的球数'),
    maxPicks: int(5, 1, 5, '金银岛每人最多购买号码数'), ticketPrice: positive(40, '金银岛每个号码价格（金币）'),
    timerSeconds: int(20, 1, 300, '选择彩票号码的时限（秒）'),
    payouts: { zero: gold(0, '命中 0 个号码的奖金'), one: gold(80, '命中 1 个号码的奖金'), two: gold(240, '命中 2 个号码的奖金'), three: gold(720, '命中 3 个号码的奖金'), four: gold(2400, '命中 4 个号码的奖金'), five: gold(8000, '命中 5 个号码的奖金') },
  },
} satisfies RuleSection;

type Resolved<T> = T extends NumberRule ? number : T extends FleetRule ? ShipType[] : { [K in keyof T]: Resolved<T[K]> };
export type GameplayTuning = Resolved<typeof schema>;

const isRule = (value: Rule | RuleSection): value is Rule => value.kind === 'number' || value.kind === 'fleet';
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const shipTypes: readonly ShipType[] = ['warship', 'cargo', 'explorer'];
const validFleet = (value: unknown): value is ShipType[] => Array.isArray(value) && value.length > 0 &&
  value.length <= 40 && [...value].every((ship) => shipTypes.includes(ship));

export function resolveGameplayTuning(override?: unknown): { rules: GameplayTuning; warnings: string[] } {
  const warnings: string[] = [];
  function resolve(section: RuleSection, input: unknown, parent = ''): Record<string, unknown> {
    const overrides = isRecord(input) ? input : {};
    if (input !== undefined && !isRecord(input)) warnings.push(parent.slice(0, -1) || 'config.json');
    for (const key of Object.keys(overrides)) {
      if (!Object.hasOwn(section, key)) warnings.push(parent + key);
    }
    return Object.fromEntries(Object.entries(section).map(([key, rule]) => {
      const path = parent + key;
      const value = Object.hasOwn(overrides, key) ? overrides[key] : undefined;
      if (!isRule(rule)) return [key, resolve(rule, value, path + '.')];
      if (rule.kind === 'fleet') {
        if (validFleet(value)) return [key, [...value]];
        if (value !== undefined) warnings.push(path);
        return [key, [...rule.value]];
      }
      if (typeof value === 'number' && Number.isFinite(value) && value >= rule.min && value <= rule.max &&
          (!rule.integer || Number.isSafeInteger(value))) return [key, value];
      if (value !== undefined) warnings.push(path);
      return [key, rule.value];
    }));
  }
  const rules = resolve(schema, override) as GameplayTuning;
  if (rules.starting.fleet.length > rules.ships.maxFleetSize) {
    if (rules.ships.maxFleetSize !== schema.ships.maxFleetSize.value) warnings.push('ships.maxFleetSize');
    rules.ships.maxFleetSize = schema.ships.maxFleetSize.value;
    if (rules.starting.fleet.length > rules.ships.maxFleetSize) {
      warnings.push('starting.fleet');
      rules.starting.fleet = [...fleet.value];
    }
  }
  for (const event of ['treasure', 'storm'] as const) {
    if (rules.sea[event].min > rules.sea[event].max) {
      warnings.push(`sea.${event}`);
      const { min, max, step } = schema.sea[event];
      rules.sea[event] = { min: min.value, max: max.value, step: step.value };
    }
  }
  return { rules, warnings };
}

export const DEFAULT_GAMEPLAY_TUNING = resolveGameplayTuning().rules;

// Each app renderer hosts only one active local or online match. The shared server never selects custom tuning.
export const GAMEPLAY_TUNING = resolveGameplayTuning().rules;

export function selectGameplayTuning(rules: GameplayTuning = DEFAULT_GAMEPLAY_TUNING): void {
  function assign(target: Record<string, unknown>, source: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(source)) {
      const current = target[key];
      if (Array.isArray(current) && Array.isArray(value)) current.splice(0, current.length, ...value);
      else if (isRecord(current) && isRecord(value)) assign(current, value);
      else target[key] = value;
    }
  }
  assign(GAMEPLAY_TUNING, rules);
}

export function gameplayTuningFields() {
  const visit = (section: RuleSection, parent = ''): [string, Rule][] =>
    Object.entries(section).flatMap(([key, rule]) => isRule(rule) ? [[parent + key, rule]] : visit(rule, parent + key + '.'));
  return visit(schema);
}
