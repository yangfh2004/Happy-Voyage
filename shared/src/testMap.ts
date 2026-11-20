import type { MapNode, EventKind } from './types';

/** Compact route for deterministic AI forecasting regression tests. */
export function forecastMap(): MapNode[] {
  const prices = [0, 120, 130, 0, 140, 160, 170, 0, 190, 200, 210, 0, 230, 220, 0, 260, 250, 270, 0, 280, 300, 0, 290, 310];
  const events: Record<number, EventKind> = { 3: 'treasure', 7: 'storm', 11: 'tradeWind', 14: 'treasure', 18: 'storm', 21: 'tradeWind' };
  return prices.map((price, id) => ({ id, name: `Stop ${id}`, x: id, y: 0, kind: id === 0 ? 'port' : events[id] ? 'event' : 'island', price, toll: Math.round(price * 0.4), event: events[id] }));
}
