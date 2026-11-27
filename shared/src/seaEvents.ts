import type { EventKind, SeaEventResult } from './types';
import { localize, ref, tx, type Text, type TextParam } from './i18n';

export const SEA_EVENT_NAMES: Record<EventKind, string> = {
  openSea: 'Open sea',
  treasure: 'Sunken treasure', storm: 'Storm', tradeWind: 'Trade winds', pirates: 'Pirates',
  smallMonster: 'Small sea monster', largeMonster: 'Large sea monster', turtle: 'Destructive sea turtle',
  whirlpool: 'Bermuda whirlpool', bottle: 'Message bottle', floatingCargo: 'Floating cargo',
  merchant: 'Merchant ship', wyvern: 'Wyvern',
};

export function seaEventText(event: SeaEventResult, destination?: string): string {
  return localize('en', seaEventTx(event, destination));
}

const OUTCOMES: Record<SeaEventResult['outcome'], [string, string]> = {
  protected: ['Protection blocks the hazard', '庇护挡下了灾难'], victory: ['Victory', '胜利'], defeat: ['Defeated', '战败'],
  damaged: ['Fleet damaged', '舰队受损'], sunk: ['Ship sunk', '船只沉没'], gold: ['Gold recovered', '获得金币'], specialPrize: ['Rare special prize!', '稀有特别奖！'],
  repaired: ['Fleet fully repaired for free', '舰队免费全面修复'], cargo: ['Specialty cargo recovered', '打捞到特产货物'],
  accepted: ['Trade accepted', '交易成功'], declined: ['Trade declined', '拒绝交易'], noTrade: ['No affordable trade or free cargo space', '没有可交易的货物或可用货舱'],
  relocated: ['Carried to {dest}', '被带往{dest}'], escaped: ['Escaped the circling currents', '逃离了漩涡'],
};

/** The sea event as a message in every language; `destination` names where a wyvern or whirlpool carried the fleet. */
export function seaEventTx(event: SeaEventResult, destination?: TextParam): Text {
  if (event.salvageFee !== undefined) {
    return tx('Wreck salvage: paid {fee}g and recovered {gold}g.', '沉船打捞：支付 {fee} 金币，打捞到 {gold} 金币。', {
      fee: event.salvageFee, gold: event.gold ?? 0,
    });
  }
  const en: string[] = [];
  const zh: string[] = [];
  if (event.gold) {
    en.push(event.gold > 0 ? 'gained {gold}g' : 'lost {gold}g');
    zh.push(event.gold > 0 ? '获得 {gold} 金币' : '损失 {gold} 金币');
  }
  if (event.damage) { en.push('{damage} hull damage'); zh.push('船体受损 {damage}'); }
  if (event.shipsLost?.length) { en.push(`{lost} ship${event.shipsLost.length === 1 ? '' : 's'} sunk`); zh.push('{lost} 艘船沉没'); }
  if (event.quantity && event.good) {
    en.push(`${event.outcome === 'accepted' ? 'sold' : 'loaded'} {quantity} {good}`);
    zh.push(`${event.outcome === 'accepted' ? '卖出' : '装载'} {quantity} 单位{good}`);
  }
  const [outcomeEn, outcomeZh] = OUTCOMES[event.outcome];
  return tx(`{name}! ${outcomeEn}${en.length ? ' — ' + en.join(', ') : ''}.`, `{name}！${outcomeZh}${zh.length ? '——' + zh.join('，') : ''}。`, {
    name: ref.event(event.event),
    dest: destination ?? tx('stop {n}', '第 {n} 站', { n: event.destination ?? '' }),
    gold: Math.abs(event.gold ?? 0), damage: event.damage ?? 0, lost: event.shipsLost?.length ?? 0, quantity: event.quantity ?? 0,
    good: event.good ? ref.good(event.good) : '',
  });
}
