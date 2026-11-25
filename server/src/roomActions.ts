import { BUILDINGS, GOODS, HERMITS, SHIP_TYPES, STRATEGIES, isRetreatThreshold, type GameEngine, type MarketOrder, type RoomAction } from '@happy-voyage/shared';

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const keyOf = <T extends object>(choices: T) =>
  (value: unknown): value is Extract<keyof T, string> => typeof value === 'string' && Object.hasOwn(choices, value);
const good = (value: unknown): value is MarketOrder['good'] => GOODS.some((entry) => entry === value);
const hermit = (value: unknown): value is (typeof HERMITS)[number]['id'] => HERMITS.some(({ id }) => id === value);
const marketOrder = (value: unknown): value is MarketOrder => {
  const { side, shipId, good: item, quantity } = object(value);
  return (side === 'buy' || side === 'sell') && integer(shipId) && good(item) && integer(quantity);
};

function invalid(): never {
  throw new Error('Invalid game command.');
}

type Handler = (engine: GameEngine, args: unknown[]) => void;
const noArgs = (apply: (engine: GameEngine) => void): Handler => (engine, args) => {
  if (args.length) invalid();
  apply(engine);
};
const oneArg = <T>(valid: (value: unknown) => value is T, apply: (engine: GameEngine, arg: T) => void): Handler => (engine, args) => {
  if (args.length !== 1 || !valid(args[0])) invalid();
  apply(engine, args[0]);
};
const cargo = (method: 'loadCargo' | 'unloadCargo'): Handler => (engine, [ship, item, quantity, ...extra]) => {
  if (extra.length || !integer(ship) || !good(item) || !integer(quantity)) invalid();
  engine[method](ship, item, quantity);
};

const actions: Record<RoomAction[0], Handler> = {
  setRetreatThreshold: oneArg(isRetreatThreshold, (e, threshold) => e.setRetreatThreshold(threshold)),
  spinCompass: noArgs((e) => e.spinCompass()),
  returnToColony: oneArg(integer, (e, id) => e.returnToColony(id)),
  claim: noArgs((e) => e.claim()),
  decline: noArgs((e) => e.decline()),
  acceptMerchant: noArgs((e) => e.acceptMerchant()),
  buyMerchant: oneArg(integer, (e, quantity) => e.buyMerchant(quantity)),
  declineMerchant: noArgs((e) => e.declineMerchant()),
  wyvernFly: oneArg(integer, (e, id) => e.wyvernFly(id)),
  payToll: noArgs((e) => e.payToll()),
  fight: (e, args) => {
    if (!args.length) { e.fight(); return; }
    const [ids] = args;
    if (args.length !== 1 || !Array.isArray(ids) || !ids.every(integer)) invalid();
    e.fight(ids);
  },
  useStrategy: (e, [card, target, ...extra]) => {
    if (!keyOf(STRATEGIES)(card) || extra.length) invalid();
    if (target !== undefined && target !== null && !integer(target)) invalid();
    e.useStrategy(card, target === null ? undefined : target as number | undefined);
  },
  acceptBarter: oneArg(integer, (e, index) => e.acceptBarter(index)),
  recruitCaptain: oneArg(integer, (e, index) => e.recruitCaptain(index)),
  declineRecruit: noArgs((e) => e.declineRecruit()),
  declineBarter: noArgs((e) => e.declineBarter()),
  buyLotteryNumber: oneArg(integer, (e, number) => e.buyLotteryNumber(number)),
  drawLottery: noArgs((e) => e.drawLottery()),
  finishLottery: noArgs((e) => e.finishLottery()),
  challengeHermit: oneArg(hermit, (e, id) => e.challengeHermit(id)),
  takeMistStones: oneArg(integer, (e, count) => e.takeMistStones(count)),
  leaveMistIsland: noArgs((e) => e.leaveMistIsland()),
  leaveRevivalIsland: noArgs((e) => e.leaveRevivalIsland()),
  dockShip: oneArg(integer, (e, id) => e.dockShip(id)),
  boardShip: oneArg(integer, (e, id) => e.boardShip(id)),
  loadCargo: cargo('loadCargo'),
  unloadCargo: cargo('unloadCargo'),
  autoLoad: noArgs((e) => e.autoLoad()),
  build: oneArg(keyOf(BUILDINGS), (e, kind) => e.build(kind)),
  buildShip: oneArg(keyOf(SHIP_TYPES), (e, ship) => e.buildShip(ship)),
  finishBuilding: noArgs((e) => e.finishBuilding()),
  tradeAtMarket: oneArg(marketOrder, (e, order) => e.tradeAtMarket(order)),
  finishTrading: noArgs((e) => e.finishTrading()),
  buyUsedShip: oneArg(keyOf(SHIP_TYPES), (e, ship) => e.buyUsedShip(ship)),
  sellShip: oneArg(integer, (e, id) => e.sellShip(id)),
  finishMarket: noArgs((e) => e.finishMarket()),
};

export function applyRoomAction(engine: GameEngine, payload: unknown): void {
  if (!Array.isArray(payload) || typeof payload[0] !== 'string' || !Object.hasOwn(actions, payload[0])) invalid();
  const [action, ...args] = payload;
  actions[action as RoomAction[0]](engine, args);
}
