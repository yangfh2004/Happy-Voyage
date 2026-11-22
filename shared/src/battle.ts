import type { AIDifficulty, BattleOutcome, Ship, ShipType } from './types';

export const TICK = 1 / 20;
export const BATTLE_FIELD = { width: 1600, height: 900 } as const;
export const BATTLE_STATS: Record<ShipType, { turn: number; range: number; reload: number; radius: number }> = {
  warship: { turn: 50, range: 320, reload: 3, radius: 22 },
  cargo: { turn: 45, range: 220, reload: 3, radius: 20 },
  explorer: { turn: 90, range: 260, reload: 2, radius: 16 },
};
export type BattleSide = 'attacker' | 'defender';
export type Formation = 'column' | 'line' | 'spread';
export type BattleCommand =
  | { type: 'move'; shipIds: number[]; x: number; y: number; formation?: Formation }
  | { type: 'attack'; shipIds: number[]; targetId: number }
  | { type: 'free'; shipIds: number[] }
  | { type: 'retreat' };
export type BattleLog = { tick: number; side: BattleSide; cmd: BattleCommand }[];
export interface BattleSetup {
  seed: number;
  attackers: Ship[];
  defenders: Ship[];
  attackerMultiplier?: number;
  ambush?: boolean;
}
export type BattleOrder = { type: 'free' } | { type: 'move'; x: number; y: number } | { type: 'attack'; targetId: number };
export interface BattleShip extends Ship {
  side: BattleSide;
  x: number;
  y: number;
  heading: number;
  vx: number;
  vy: number;
  reload: number;
  sunk: boolean;
  escaped: boolean;
  order: BattleOrder;
  charge: boolean;
}
export interface Cannonball {
  side: BattleSide;
  x: number;
  y: number;
  landingX: number;
  landingY: number;
  remaining: number;
  damage: number;
}
export interface BattleState {
  tick: number;
  rng: number;
  ships: BattleShip[];
  cannonballs: Cannonball[];
  retreating: boolean;
  attackerMultiplier: number;
  ambush: boolean;
  outcome: BattleOutcome | null;
}
export type BattleControllers = Partial<Record<BattleSide, AIDifficulty>>;
export interface RealtimeBattleResult {
  outcome: BattleOutcome;
  durability: { id: number; side: BattleSide; durability: number }[];
  attackerSunk: number[];
  defenderSunk: number[];
  ticks: number;
}

const active = (s: BattleShip) => !s.sunk && !s.escaped;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a: number) => ((a + 540) % 360 + 360) % 360 - 180;
const bearing = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clearance = (s: { type: ShipType }) => BATTLE_STATS[s.type].radius + 32;

function separate(ships: { x: number; y: number; type: ShipType; side?: BattleSide }[], padding = 0, retreating = false): void {
  const constrain = (s: typeof ships[number]) => {
    const radius = clearance(s) + padding;
    s.x = clamp(s.x, retreating && s.side === 'attacker' ? -100 : radius, BATTLE_FIELD.width - radius);
    s.y = clamp(s.y, radius, BATTLE_FIELD.height - radius);
  };
  ships.forEach(constrain);
  for (let pass = 0; pass < 64; pass++) {
    let overlap = 0;
    for (let i = 0; i < ships.length; i++) for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i], b = ships[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const penetration = clearance(a) + clearance(b) + padding * 2 - length;
      if (penetration <= 0) continue;
      overlap = Math.max(overlap, penetration);
      const direction = (i * ships.length + j) * 2.399963229728653;
      const nx = length > .001 ? dx / length : Math.cos(direction);
      const ny = length > .001 ? dy / length : Math.sin(direction);
      const push = penetration * .5;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      constrain(a); constrain(b);
    }
    if (overlap < .1) break;
  }
}

function random(battle: BattleState): number {
  battle.rng = (battle.rng + 0x6D2B79F5) >>> 0;
  let t = battle.rng;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

export function createBattle(setup: BattleSetup): BattleState {
  const ships = (fleet: Ship[], side: BattleSide): BattleShip[] => fleet.map((ship, i) => ({
    ...ship, cargo: { ...ship.cargo }, side, x: side === 'attacker' ? 160 + Math.floor(i / 7) * 116 : 1440 - Math.floor(i / 7) * 116,
    y: 450 + (i % 7 - (Math.min(fleet.length, 7) - 1) / 2) * 116,
    heading: side === 'attacker' ? 0 : 180, vx: 0, vy: 0, reload: 0,
    sunk: ship.durability <= 0, escaped: false, order: { type: 'free' }, charge: false,
  }));
  return { tick: 0, rng: setup.seed >>> 0, ships: [...ships(setup.attackers, 'attacker'), ...ships(setup.defenders, 'defender')],
    cannonballs: [], retreating: false, attackerMultiplier: setup.attackerMultiplier ?? 1, ambush: setup.ambush ?? false, outcome: null };
}

export function inBroadsideArc(ship: { x: number; y: number; heading: number }, target: { x: number; y: number }): boolean {
  const off = Math.abs(angle(bearing(ship, target) - ship.heading));
  return off >= 30 && off <= 150;
}

export function issueCommand(battle: BattleState, side: BattleSide, cmd: BattleCommand): void {
  if (battle.outcome || (side !== 'attacker' && side !== 'defender')) return;
  if (cmd.type === 'retreat') {
    if (side === 'attacker') battle.retreating = true;
    return;
  }
  if (cmd.type === 'move' && (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y))) return;
  if (cmd.type === 'attack' && !battle.ships.some((s) => s.id === cmd.targetId && s.side !== side && active(s))) return;
  const ships = battle.ships.filter((s) => s.side === side && active(s) && cmd.shipIds.includes(s.id));
  if (!ships.length) return;
  const spacing = Math.max(0, ...ships.map((s) => clearance(s) * 2 + 24));
  const columns = Math.ceil(Math.sqrt(ships.length));
  const targets = ships.map((s, i) => {
    const offset = (i - (ships.length - 1) / 2) * spacing;
    return { type: s.type,
      x: cmd.type === 'move' ? cmd.x + (cmd.formation === 'line' ? offset : cmd.formation === 'spread' ? (i % columns - (columns - 1) / 2) * spacing : 0) : s.x,
      y: cmd.type === 'move' ? cmd.y + (cmd.formation === 'line' ? 0 : cmd.formation === 'spread' ? (Math.floor(i / columns) - (Math.ceil(ships.length / columns) - 1) / 2) * spacing : offset) : s.y };
  });
  if (cmd.type === 'move') {
    const holding = battle.ships.filter((s) => s.side === side && active(s) && !ships.includes(s) && s.order.type === 'move');
    const heldTargets = holding.map((s) => ({ type: s.type, x: s.order.type === 'move' ? s.order.x : s.x, y: s.order.type === 'move' ? s.order.y : s.y }));
    separate([...targets, ...heldTargets], 12);
    holding.forEach((s, i) => { s.order = { type: 'move', x: heldTargets[i].x, y: heldTargets[i].y }; });
  }
  ships.forEach((s, i) => {
    s.charge = false;
    if (cmd.type === 'move') {
      s.order = { type: 'move', x: targets[i].x, y: targets[i].y };
    } else s.order = cmd.type === 'attack' ? { type: 'attack', targetId: cmd.targetId } : { type: 'free' };
  });
}

export function battleAI(battle: BattleState, side: BattleSide, difficulty: AIDifficulty): void {
  if (battle.outcome || battle.tick % 20 !== 0) return;
  const own = battle.ships.filter((s) => s.side === side && active(s));
  const enemies = battle.ships.filter((s) => s.side !== side && active(s));
  if (!enemies.length) return;
  const total = (ships: BattleShip[]) => ships.reduce((sum, s) => sum + s.durability, 0);
  if (difficulty === 'hard' && side === 'attacker' && total(own) < total(enemies) * 0.35) issueCommand(battle, side, { type: 'retreat' });
  for (const s of own) {
    const target = [...enemies].sort(difficulty === 'easy' ? (a, b) => distance(s, a) - distance(s, b) : (a, b) => a.durability - b.durability)[0];
    if (difficulty === 'hard' && (s.durability < s.maxDurability * 0.3 || s.type === 'cargo')) {
      issueCommand(battle, side, { type: 'move', shipIds: [s.id], x: s.x + (s.x - target.x), y: s.y + (s.y - target.y) });
    } else {
      issueCommand(battle, side, { type: 'attack', shipIds: [s.id], targetId: target.id });
      s.charge = difficulty === 'easy';
    }
  }
}

export function stepBattle(battle: BattleState, controllers: BattleControllers = {}): void {
  if (battle.outcome) return;
  for (const side of ['attacker', 'defender'] as const) if (controllers[side]) battleAI(battle, side, controllers[side]);
  for (const s of battle.ships.filter(active)) {
    const enemies = battle.ships.filter((e) => e.side !== s.side && active(e));
    const order = s.order;
    const target = (order.type === 'attack' ? enemies.find((e) => e.id === order.targetId) : undefined)
      ?? [...enemies].sort((a, b) => distance(s, a) - distance(s, b))[0];
    let desired = s.heading;
    let moving = false;
    const stats = BATTLE_STATS[s.type];
    if (battle.retreating && s.side === 'attacker') { desired = 180; moving = true; }
    else if (order.type === 'move') { moving = distance(s, order) > 10; if (moving) desired = bearing(s, order); }
    else if (target) {
      const bow = bearing(s, target);
      moving = s.charge || distance(s, target) > stats.range * 0.8;
      desired = moving ? bow : bow + (angle(s.heading - bow) >= 0 ? 90 : -90);
    }
    s.heading = angle(s.heading + clamp(angle(desired - s.heading), -stats.turn * TICK, stats.turn * TICK));
    s.vx = moving ? Math.cos(s.heading * Math.PI / 180) * s.speed * 12 : 0;
    s.vy = moving ? Math.sin(s.heading * Math.PI / 180) * s.speed * 12 : 0;
    s.x = clamp(s.x + s.vx * TICK, battle.retreating && s.side === 'attacker' ? -100 : stats.radius, 1600 - stats.radius);
    s.y = clamp(s.y + s.vy * TICK, stats.radius, 900 - stats.radius);
    if (s.x < 0) { s.escaped = true; continue; }
    s.reload = Math.max(0, s.reload - TICK);
  }
  separate(battle.ships.filter(active), 0, battle.retreating);
  for (const s of battle.ships.filter(active)) {
    if (s.reload > 0 || (s.side === 'defender' && battle.ambush && battle.tick < 160)) continue;
    const stats = BATTLE_STATS[s.type];
    const targets = battle.ships.filter((e) => e.side !== s.side && active(e) && distance(s, e) <= stats.range && inBroadsideArc(s, e))
      .sort((a, b) => distance(s, a) - distance(s, b));
    const order = s.order;
    const target = (order.type === 'attack' ? targets.find((e) => e.id === order.targetId) : undefined) ?? targets[0];
    if (!target) continue;
    const flight = distance(s, target) / 400;
    const landingX = target.x + target.vx * flight + (random(battle) - 0.5) * 18;
    const landingY = target.y + target.vy * flight + (random(battle) - 0.5) * 18;
    battle.cannonballs.push({ side: s.side, x: s.x, y: s.y, landingX, landingY,
      remaining: Math.hypot(landingX - s.x, landingY - s.y) / 400,
      damage: Math.round(s.firepower * (s.side === 'attacker' ? battle.attackerMultiplier : 1) * (0.75 + random(battle) * 0.5)) });
    s.reload = stats.reload;
  }
  for (const ball of battle.cannonballs) {
    const fraction = Math.min(1, TICK / ball.remaining);
    ball.x += (ball.landingX - ball.x) * fraction;
    ball.y += (ball.landingY - ball.y) * fraction;
    ball.remaining -= TICK;
    if (ball.remaining > 0) continue;
    const hit = battle.ships.filter((s) => s.side !== ball.side && active(s) && distance(s, { x: ball.landingX, y: ball.landingY }) <= BATTLE_STATS[s.type].radius)
      .sort((a, b) => distance(a, ball) - distance(b, ball))[0];
    if (hit) { hit.durability = Math.max(0, hit.durability - ball.damage); hit.sunk = hit.durability === 0; }
  }
  battle.cannonballs = battle.cannonballs.filter((b) => b.remaining > 0);
  battle.tick++;
  const attackers = battle.ships.filter((s) => s.side === 'attacker' && !s.sunk);
  const defenders = battle.ships.filter((s) => s.side === 'defender' && !s.sunk);
  battle.outcome = !attackers.length ? 'defeat' : !defenders.length ? 'victory'
    : attackers.every((s) => s.escaped) || battle.tick >= 1800 ? 'draw' : null;
}

export function battleResult(battle: BattleState): RealtimeBattleResult {
  if (!battle.outcome) throw new Error('Battle is not finished');
  return { outcome: battle.outcome, ticks: battle.tick,
    durability: battle.ships.map((s) => ({ id: s.id, side: s.side, durability: s.durability })),
    attackerSunk: battle.ships.filter((s) => s.side === 'attacker' && s.sunk).map((s) => s.id),
    defenderSunk: battle.ships.filter((s) => s.side === 'defender' && s.sunk).map((s) => s.id) };
}

export function replayBattle(setup: BattleSetup, log: BattleLog, controllers: BattleControllers = {}): RealtimeBattleResult {
  const battle = createBattle(setup);
  const commands = log.filter((entry) => Number.isInteger(entry.tick) && entry.tick >= 0 && entry.tick < 1800)
    .map((entry, index) => ({ ...entry, index })).sort((a, b) => a.tick - b.tick || a.index - b.index);
  let next = 0;
  while (!battle.outcome) {
    while (commands[next]?.tick === battle.tick) {
      const entry = commands[next++];
      issueCommand(battle, entry.side, entry.cmd);
    }
    stepBattle(battle, controllers);
  }
  return battleResult(battle);
}
