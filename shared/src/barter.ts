import { GOODS } from './ships';
import type { BarterOffer, Good, Player } from './types';
import type { Rng } from './compass';

export const GOOD_VALUES: Record<Good, number> = {
  lumber: 10, iron: 20, Cotton: 25, Timber: 30, Sugar: 35, Wine: 40,
  Cocoa: 45, Tobacco: 50, Tea: 60, Spices: 75, Silk: 90, Silver: 100,
};

export function fleetQuantity(player: Player, good: Good): number {
  return player.fleet.reduce((sum, ship) => sum + (ship.cargo[good] ?? 0), 0);
}

export function barterOffers(player: Player, rng: Rng): BarterOffer[] {
  const cheap = GOODS.filter((good) => GOOD_VALUES[good] <= 50 && fleetQuantity(player, good) > 0);
  const offers: BarterOffer[] = [];
  while (cheap.length && offers.length < 3) {
    const give = cheap.splice(Math.floor(rng() * cheap.length), 1)[0];
    const valuable = GOODS.filter((good) => GOOD_VALUES[good] > GOOD_VALUES[give]);
    const receive = valuable[Math.floor(rng() * valuable.length)];
    const giveQty = 1 + Math.floor(rng() * Math.min(5, fleetQuantity(player, give)));
    const receiveQty = Math.min(giveQty, Math.floor(giveQty * GOOD_VALUES[give] / GOOD_VALUES[receive]) + 1);
    offers.push({ give, giveQty, receive, receiveQty });
  }
  return offers;
}
