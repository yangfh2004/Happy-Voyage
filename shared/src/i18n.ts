import type { BuildingKind, EventKind, GameState, Good, MapNode, Player, ShipType, SpecialKind } from './types';
import type { StrategyId } from './strategies';
import type { CampaignObjective, CampaignStageId } from './campaign';
import type { GameModeId } from './modes';
import { NAVIGATORS, navigatorById } from './navigators';

/** Languages every screen offers. */
export type Locale = 'en' | 'zh';
export const LOCALES: readonly { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh', label: '简体中文' },
];

/** A name the reader's language decides: resolved against the game state when shown. */
export type NameRef =
  | { ref: 'player'; id: number }
  | { ref: 'node'; id: number }
  | { ref: 'good'; id: Good }
  | { ref: 'goods'; ids: Good[] }
  | { ref: 'strategy'; id: StrategyId }
  | { ref: 'building'; id: BuildingKind }
  | { ref: 'ship'; name: string }
  | { ref: 'ships'; names: string[] }
  | { ref: 'shipType'; id: ShipType }
  | { ref: 'nation'; id: string }
  | { ref: 'rank'; id: number }
  | { ref: 'captain'; id: string }
  | { ref: 'hermit'; id: string }
  | { ref: 'stage'; id: CampaignStageId }
  | { ref: 'mission'; stage: CampaignStageId; objective: CampaignObjective }
  | { ref: 'event'; id: EventKind }
  | { ref: 'list'; items: (string | number)[] };

export type TextParam = string | number | NameRef | Text;

/** A serialisable message in every locale, so logs and headlines can switch language after they are written. */
export interface Text {
  en: string;
  zh: string;
  params?: Record<string, TextParam>;
}

export function tx(en: string, zh: string, params?: Record<string, TextParam>): Text {
  return params ? { en, zh, params } : { en, zh };
}

/** Campaign wording lives beside the stages (campaign.ts), which registers it here to avoid an import cycle. */
const campaignText = {
  stage: (id: CampaignStageId, _locale: Locale): { name: string } => ({ name: id }),
  mission: (_stage: CampaignStageId, objective: CampaignObjective, _locale: Locale): string => objective,
};
export function registerCampaignText(text: typeof campaignText): void {
  Object.assign(campaignText, text);
}

export const ref = {
  player: (id: number): NameRef => ({ ref: 'player', id }),
  node: (id: number): NameRef => ({ ref: 'node', id }),
  good: (id: Good): NameRef => ({ ref: 'good', id }),
  strategy: (id: StrategyId): NameRef => ({ ref: 'strategy', id }),
  building: (id: BuildingKind): NameRef => ({ ref: 'building', id }),
  ship: (name: string): NameRef => ({ ref: 'ship', name }),
  ships: (names: string[]): NameRef => ({ ref: 'ships', names }),
  shipType: (id: ShipType): NameRef => ({ ref: 'shipType', id }),
  nation: (id: string): NameRef => ({ ref: 'nation', id }),
  rank: (id: number): NameRef => ({ ref: 'rank', id }),
  captain: (id: string): NameRef => ({ ref: 'captain', id }),
  hermit: (id: string): NameRef => ({ ref: 'hermit', id }),
  stage: (id: CampaignStageId): NameRef => ({ ref: 'stage', id }),
  mission: (stage: CampaignStageId, objective: CampaignObjective): NameRef => ({ ref: 'mission', stage, objective }),
  event: (id: EventKind): NameRef => ({ ref: 'event', id }),
  list: (items: (string | number)[]): NameRef => ({ ref: 'list', items }),
};

/** Fill `{name}` placeholders. */
export function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

type NameState = Pick<GameState, 'players' | 'map'>;

export function localize(locale: Locale, text: Text, state?: NameState | null): string {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(text.params ?? {})) params[key] = localizeParam(locale, value, state);
  return format(text[locale], params);
}

function localizeParam(locale: Locale, value: TextParam, state?: NameState | null): string | number {
  if (typeof value !== 'object') return value;
  if ('en' in value) return localize(locale, value, state);
  const zh = locale === 'zh';
  const join = (items: (string | number)[]) => items.join(zh ? '、' : ', ');
  switch (value.ref) {
    case 'player': { const player = state?.players[value.id]; return player ? playerName(player, locale) : `#${value.id}`; }
    case 'node': { const node = state?.map[value.id]; return node ? nodeName(node, locale) : `#${value.id}`; }
    case 'good': return goodName(value.id, locale);
    case 'goods': return join(value.ids.map((id) => goodName(id, locale)));
    case 'strategy': return zh ? ZH.strategies[value.id].name : EN_NAMES.strategy(value.id);
    case 'building': return buildingName(value.id, locale);
    case 'ship': return shipName(value.name, locale);
    case 'ships': return value.names.length ? join(value.names.map((name) => shipName(name, locale))) : zh ? '无' : 'none';
    case 'shipType': return shipTypeName(value.id, locale);
    case 'nation': return nationName(value.id, locale);
    case 'rank': return rankName(value.id, locale);
    case 'captain': return captainName(value.id, locale);
    case 'hermit': return hermitName(value.id, locale);
    case 'stage': return campaignText.stage(value.id, locale).name;
    case 'mission': return campaignText.mission(value.stage, value.objective, locale);
    case 'event': return seaEventName(value.id, locale);
    case 'list': return join(value.items);
  }
}

// English names come from the rule modules; imported lazily to avoid import cycles.
import { STRATEGIES } from './strategies';
import { RANKS } from './ranks';
import { BUILDINGS } from './buildings';
import { CAPTAINS } from './captains';
import { HERMITS } from './mist';
import { SHIP_TYPES } from './ships';
import { SEA_EVENT_NAMES } from './seaEvents';

const EN_NAMES = { strategy: (id: StrategyId) => STRATEGIES[id].name };

export const ZH = {
  nations: { Spain: '西班牙', Netherlands: '荷兰', England: '英国', Portugal: '葡萄牙', China: '中国', France: '法国', Japan: '日本', Germany: '德国', Italy: '意大利', Korea: '韩国' } as Record<string, string>,
  lands: {
    Madeira: '马德拉', 'Canary Isles': '加那利群岛', 'Cape Verde': '佛得角', Azores: '亚速尔群岛', Hispaniola: '伊斯帕尼奥拉', Cuba: '古巴',
    Yucatan: '尤卡坦', Veracruz: '韦拉克鲁斯', Cartagena: '卡塔赫纳', Guiana: '圭亚那', Pernambuco: '伯南布哥', Bahia: '巴伊亚',
    'Rio de Janeiro': '里约热内卢', Patagonia: '巴塔哥尼亚', 'Tierra del Fuego': '火地岛', Valparaiso: '瓦尔帕莱索', Callao: '卡亚俄',
    Panama: '巴拿马', 'Gold Coast': '黄金海岸', Benin: '贝宁', Luanda: '罗安达', 'Cape of Good Hope': '好望角', Mozambique: '莫桑比克',
    Zanzibar: '桑给巴尔', Sofala: '索法拉', Madagascar: '马达加斯加', Socotra: '索科特拉', Muscat: '马斯喀特', Goa: '果阿',
    Calicut: '卡利卡特', Ceylon: '锡兰', Malacca: '马六甲', Sumatra: '苏门答腊', Java: '爪哇', Borneo: '婆罗洲', Moluccas: '摩鹿加群岛',
    Luzon: '吕宋', Formosa: '福尔摩沙', Ryukyu: '琉球', Hokkaido: '北海道',
    'Treasure Shoal': '宝藏浅滩', 'Tempest Passage': '风暴水道', 'Zephyr Strait': '和风海峡', 'Pirate Cove': '海盗湾',
    'Serpent Shallows': '海蛇浅滩', 'Bermuda Triangle': '百慕达三角', 'Drifting Bottle Reef': '漂流瓶礁', 'Castaway Cargo Bay': '浮货湾',
    'Merchant Lane': '商船航道', 'Wyvern Cliffs': '翼龙崖', 'Kraken Deep': '海怪深渊', 'Turtle Reach': '海龟海域', 'Sunken Crown Shoal': '沉冠浅滩',
  } as Record<string, string>,
  specials: { skeleton: '骷髅岛', treasure: '金银岛', mist: '迷雾岛', revival: '复活岛', nightless: '不夜岛', wind: '风之岛', dragonSnake: '龙蛇岛' } as Record<SpecialKind, string>,
  goods: { lumber: '木材', iron: '铁矿', Wine: '葡萄酒', Sugar: '砂糖', Cotton: '棉花', Timber: '硬木', Cocoa: '可可', Tobacco: '烟草', Silver: '白银', Spices: '香料', Silk: '丝绸', Tea: '茶叶' } as Record<Good, string>,
  shipTypes: { warship: '战舰', cargo: '货船', explorer: '探险船' } as Record<ShipType, string>,
  ships: {
    'Santa María': '圣玛利亚号', 'Halve Maen': '半月号', Endeavour: '奋进号', Victoria: '维多利亚号', 'Treasure Ship': '宝船',
    Satisfaction: '满足号', 'San Juan Bautista': '圣胡安·包蒂斯塔号', 'Adler von Lübeck': '吕贝克之鹰号', 'La Dauphine': '王太子妃号',
    'Turtle Ship': '龟船', Pirate: '海盗船',
  } as Record<string, string>,
  titles: {
    columbus: '大洋海军上将', juliana: '阿姆斯特丹商人', cook: '皇家海军舰长', magellan: '环球航行第一人', zhengHe: '宝船舰队统帅',
    morgan: '加勒比海的梦魇', hasekura: '横渡太平洋的使节', behaim: '首个地球仪的制作者', verrazzano: '新大陆海岸探险家', yiSunSin: '龟船舰队统帅',
  } as Record<string, string>,
  strategies: {
    navigate: { name: '导航', description: '不转罗盘，直接驶往任意地点。' },
    inspire: { name: '激励', description: '本回合下一场战斗火力提升 50%。' },
    mislead: { name: '误导', description: '把一艘守军船只引向陆地触礁沉没。' },
    locate: { name: '测位', description: '揭示埋藏宝藏的位置，直到有人挖走为止。' },
    betray: { name: '背叛', description: '说服一艘守军船只倒戈加入你的舰队。' },
  } as Record<StrategyId, { name: string; description: string }>,
  buildings: {
    lumberMill: { name: '木材厂', description: '每回合生产造船用木材。' },
    ironMine: { name: '铁矿厂', description: '每回合生产铁矿，各岛产量不同。' },
    shipyard: { name: '造船厂', description: '用本地木材与铁矿造船。船厂越大，能造的船越大。' },
    repairYard: { name: '修船厂', description: '在所有者回合开始时免费修好停靠的船只。' },
    collectionField: { name: '采集场', description: '每回合采集当地特产。' },
  } as Record<BuildingKind, { name: string; description: string }>,
  hermits: { brook: { name: '溪边隐士', style: '温和' }, pine: { name: '松下隐士', style: '大胆' }, summit: { name: '峰顶隐士', style: '高手' } } as Record<string, { name: string; style: string }>,
  events: {
    treasure: '沉没的宝藏', storm: '风暴', tradeWind: '信风', pirates: '海盗', smallMonster: '小海怪', largeMonster: '大海怪',
    turtle: '破坏力超强的海龟', whirlpool: '百慕达漩涡', bottle: '漂流玻璃瓶', floatingCargo: '浮货', merchant: '海上商船', wyvern: '翼龙',
  } as Record<EventKind, string>,
  modes: {
    conquest: { name: '经典征服', description: '原作规则：同时占领所有新大陆。不限回合。' },
    quick: { name: '快速对局', description: '占领 10 座岛屿，或在 50 回合后成为首富。' },
    sprint: { name: '冲刺赛', description: '占领 6 座岛屿，或在 20 回合后成为首富。' },
  } as Record<GameModeId, { name: string; description: string }>,
  stages: {
    'first-voyage': { name: '初次远航', briefing: '在新大陆插上王室的旗帜，然后返回母国报告你的发现。' },
    'merchant-charter': { name: '商人特许状', briefing: '驶往不夜岛出售特产，并建造采集场为日后的航行供货。' },
    'crown-of-the-seas': { name: '海洋之冠', briefing: '在国王的期限前扩张舰队领地，并夺取一块对手殖民地。' },
  } as Record<CampaignStageId, { name: string; briefing: string }>,
  missions: {
    foundColony: '在无人占领的岛屿上建立殖民地', reportHome: '持有殖民地时回到母港', sellSpecialties: '在不夜岛出售 3 单位特产',
    buildCollectionField: '在你的殖民地建造采集场', holdColonies: '同时持有 2 块殖民地', captureColony: '赢得海战，夺取一块对手殖民地',
  } as Record<CampaignObjective, string>,
};

export function nationName(nation: string, locale: Locale): string {
  return locale === 'zh' ? ZH.nations[nation] ?? nation : nation;
}

export function nodeName(node: MapNode, locale: Locale): string {
  if (locale === 'en') return node.name;
  if (node.special) return node.chineseName ?? ZH.specials[node.special];
  if (node.kind === 'port' && node.nation) return `${nationName(node.nation, locale)}港`;
  return ZH.lands[node.name] ?? node.name;
}

export function goodName(good: Good, locale: Locale): string {
  return locale === 'zh' ? ZH.goods[good] ?? good : good;
}

export function shipTypeName(type: ShipType, locale: Locale): string {
  return locale === 'zh' ? ZH.shipTypes[type] : SHIP_TYPES[type].label;
}

/** Ships keep their English name in the state; built ships ("Warship 4") and signature ships translate. */
export function shipName(name: string, locale: Locale): string {
  if (locale === 'en') return name;
  if (ZH.ships[name]) return ZH.ships[name];
  for (const [type, stats] of Object.entries(SHIP_TYPES) as [ShipType, { label: string }][]) {
    const match = name.match(new RegExp(`^${stats.label} (\\d+)$`));
    if (match) return `${ZH.shipTypes[type]} ${match[1]}`;
  }
  return name;
}

/** Default navigator names follow the language; names a person typed stay as written. */
export function playerName(player: Pick<Player, 'name' | 'navigator'>, locale: Locale): string {
  const navigator = player.navigator ? navigatorById(player.navigator) : undefined;
  return locale === 'zh' && navigator && player.name === navigator.name ? navigator.chineseName : player.name;
}

export function navigatorName(id: string, locale: Locale): string {
  const navigator = NAVIGATORS.find((candidate) => candidate.id === id);
  if (!navigator) return id;
  return locale === 'zh' ? navigator.chineseName : navigator.name;
}

export function navigatorTitle(id: string, locale: Locale): string {
  return locale === 'zh' ? ZH.titles[id] ?? '' : navigatorById(id)?.title ?? '';
}

export function rankName(rank: number, locale: Locale): string {
  return locale === 'zh' ? RANKS[rank].chineseName : RANKS[rank].name;
}

export function strategyText(id: StrategyId, locale: Locale): { name: string; description: string } {
  return locale === 'zh' ? ZH.strategies[id] : { name: STRATEGIES[id].name, description: STRATEGIES[id].description };
}

export function buildingName(kind: BuildingKind, locale: Locale): string {
  return locale === 'zh' ? ZH.buildings[kind].name : BUILDINGS[kind].label;
}

export function buildingDescription(kind: BuildingKind, locale: Locale): string {
  return locale === 'zh' ? ZH.buildings[kind].description : BUILDINGS[kind].description;
}

export function captainName(id: string, locale: Locale): string {
  const captain = CAPTAINS.find((candidate) => candidate.id === id);
  if (!captain) return id;
  return locale === 'zh' ? captain.chineseName : captain.name;
}

export function captainDescriptionText(id: string, locale: Locale): string {
  const captain = CAPTAINS.find((candidate) => candidate.id === id)!;
  if (locale === 'en') return captain.bonus === 'salary' ? `+${captain.amount}g per home salary` :
    `${Math.round(captain.amount * 100)}% less ${captain.bonus === 'toll' ? 'colony toll' : 'foreign tax'}`;
  return captain.bonus === 'salary' ? `每次母港薪俸 +${captain.amount} 金币` :
    `${captain.bonus === 'toll' ? '殖民地过路费' : '外国税金'}减少 ${Math.round(captain.amount * 100)}%`;
}

export function hermitText(id: string, locale: Locale): { name: string; style: string } {
  const hermit = HERMITS.find((candidate) => candidate.id === id);
  if (locale === 'zh' && ZH.hermits[id]) return ZH.hermits[id];
  return { name: hermit?.name ?? id, style: hermit?.style ?? '' };
}

export function hermitName(id: string, locale: Locale): string {
  return hermitText(id, locale).name;
}

export function seaEventName(event: EventKind, locale: Locale): string {
  return locale === 'zh' ? ZH.events[event] : SEA_EVENT_NAMES[event];
}
