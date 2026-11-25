import { GOODS } from './ships';
import { GAMEPLAY_TUNING } from './gameplayTuning';
import type { BarterOffer, Good, Player } from './types';
import type { Rng } from './compass';

export const GOOD_VALUES: Record<Good, number> = GAMEPLAY_TUNING.barter.values;

export function fleetQuantity(player: Player, good: Good): number {
  return player.fleet.reduce((sum, ship) => sum + (ship.cargo[good] ?? 0), 0);
}

export function barterOffers(player: Player, rng: Rng): BarterOffer[] {
  const { giveValueCap, offers: limit, maxUnits } = GAMEPLAY_TUNING.barter;
  const mostValuable = Math.max(...Object.values(GOOD_VALUES));
  const cheap = GOODS.filter((good) => GOOD_VALUES[good] <= giveValueCap && GOOD_VALUES[good] < mostValuable && fleetQuantity(player, good) > 0);
  const offers: BarterOffer[] = [];
  while (cheap.length && offers.length < limit) {
    const give = cheap.splice(Math.floor(rng() * cheap.length), 1)[0];
    const valuable = GOODS.filter((good) => GOOD_VALUES[good] > GOOD_VALUES[give]);
    const receive = valuable[Math.floor(rng() * valuable.length)];
    const giveQty = 1 + Math.floor(rng() * Math.min(maxUnits, fleetQuantity(player, give)));
    const receiveQty = Math.min(giveQty, Math.floor(giveQty * GOOD_VALUES[give] / GOOD_VALUES[receive]) + 1);
    offers.push({ give, giveQty, receive, receiveQty });
  }
  return offers;
}
