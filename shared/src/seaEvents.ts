import type { EventKind, SeaEventResult } from './types';

export const SEA_EVENT_NAMES: Record<EventKind, string> = {
  treasure: 'Sunken treasure', storm: 'Storm', tradeWind: 'Trade winds', pirates: 'Pirates',
  smallMonster: 'Small sea monster', largeMonster: 'Large sea monster', turtle: 'Destructive sea turtle',
  whirlpool: 'Bermuda whirlpool', bottle: 'Message bottle', floatingCargo: 'Floating cargo',
  merchant: 'Merchant ship', wyvern: 'Wyvern',
};

export function seaEventText(event: SeaEventResult, destination?: string): string {
  const outcomes: Record<SeaEventResult['outcome'], string> = {
    protected: 'Revival protection blocks the hazard', victory: 'Victory', defeat: 'Defeated',
    damaged: 'Fleet damaged', sunk: 'Ship sunk', gold: 'Gold recovered', specialPrize: 'Rare special prize!',
    repaired: 'Fleet fully repaired for free', cargo: 'Specialty cargo recovered',
    accepted: 'Trade accepted', declined: 'Trade declined', noTrade: 'No aboard specialties to trade',
    relocated: 'Carried to ' + (destination ?? `stop ${event.destination}`), escaped: 'Escaped the circling currents',
  };
  const details: string[] = [];
  if (event.gold) details.push(event.gold > 0 ? `gained ${event.gold}g` : `lost ${-event.gold}g`);
  if (event.damage) details.push(`${event.damage} hull damage`);
  if (event.shipsLost?.length) details.push(`${event.shipsLost.length} ship${event.shipsLost.length === 1 ? '' : 's'} sunk`);
  if (event.quantity && event.good) details.push(`${event.outcome === 'accepted' ? 'sold' : 'loaded'} ${event.quantity} ${event.good}`);
  return `${SEA_EVENT_NAMES[event.event]}! ${outcomes[event.outcome]}${details.length ? ' — ' + details.join(', ') : ''}.`;
}
