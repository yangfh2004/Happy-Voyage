import type { AIDifficulty, BattleOutcome, Ship, ShipType } from './types';
import { sinkingCap, withdrawalReason, type BattleWithdrawal } from './withdrawal';

export const TICK = 1 / 20;
export const BATTLE_FIELD = { width: 2400, height: 1350 } as const;
const CANNONBALL_SPEED = 800;
export const BATTLE_STATS: Record<ShipType, { turn: number; range: number; reload: number; radius: number }> = {
  warship: { turn: 50, range: 640, reload: 3, radius: 22 },
  cargo: { turn: 45, range: 440, reload: 3, radius: 20 },
  explorer: { turn: 90, range: 520, reload: 2, radius: 16 },
};
export type BattleSide = 'attacker' | 'defender';
export type Formation = 'column' | 'line' | 'spread';
export type BattleCommand =
  | { type: 'move'; shipIds: number[]; x: number; y: number; formation?: Formation }
  | { type: 'attack'; shipIds: number[]; targetId: number; formation?: Formation }
  | { type: 'free'; shipIds: number[]; formation?: Formation }
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
export interface BattleGroup {
  id: number;
  side: BattleSide;
  shipIds: number[];
  formation: Formation;
  leaderId: number;
  heading: number;
  moveHeading?: number;
  formingTicks?: number;
  order: BattleOrder;
}
export interface BattleShip extends Ship {
  side: BattleSide;
  x: number;
  y: number;
  heading: number;
  vx: number;
  vy: number;
  reload: number;
  sunk: boolean;
  startedAfloat: boolean;
  escaped: boolean;
  order: BattleOrder;
  charge: boolean;
  groupId?: number;
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
  groups: BattleGroup[];
  nextGroupId: number;
  lastFormations: Record<BattleSide, Formation>;
  cannonballs: Cannonball[];
  retreating: boolean;
  attackerMultiplier: number;
  ambush: boolean;
  outcome: BattleOutcome | null;
  withdrawal: BattleWithdrawal | null;
}
export type BattleControllers = Partial<Record<BattleSide, AIDifficulty>>;
export interface RealtimeBattleResult {
  outcome: BattleOutcome;
  durability: { id: number; side: BattleSide; durability: number }[];
  attackerSunk: number[];
  defenderSunk: number[];
  ticks: number;
  withdrawal?: BattleWithdrawal;
}

const active = (s: BattleShip) => !s.sunk && !s.escaped;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a: number) => ((a + 540) % 360 + 360) % 360 - 180;
const bearing = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clearance = (s: { type: ShipType }) => BATTLE_STATS[s.type].radius + 32;

function separate(ships: { x: number; y: number; type: ShipType; side?: BattleSide; id?: number; groupId?: number }[], padding = 0, retreating = false, groups: BattleGroup[] = []): void {
  const leaders = new Map(groups.map(g => [g.id, g.leaderId]));
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
      const leaderId = a.groupId !== undefined && a.groupId === b.groupId ? leaders.get(a.groupId) : undefined;
      const share = leaderId === undefined ? .5 : leaderId === a.id ? 0 : leaderId === b.id ? 1 : .5;
      a.x -= nx * penetration * share; a.y -= ny * penetration * share;
      b.x += nx * penetration * (1 - share); b.y += ny * penetration * (1 - share);
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
  const spacing = BATTLE_FIELD.width * .0725;
  const ships = (fleet: Ship[], side: BattleSide): BattleShip[] => fleet.map((ship, i) => ({
    ...ship, cargo: { ...ship.cargo }, side, x: BATTLE_FIELD.width * (side === 'attacker' ? .1 : .9) + (side === 'attacker' ? 1 : -1) * Math.floor(i / 7) * spacing,
    y: BATTLE_FIELD.height / 2 + (i % 7 - (Math.min(fleet.length, 7) - 1) / 2) * spacing,
    heading: side === 'attacker' ? 0 : 180, vx: 0, vy: 0, reload: 0,
    sunk: ship.durability <= 0, startedAfloat: ship.durability > 0, escaped: false, order: { type: 'free' }, charge: false,
  }));
  return { tick: 0, rng: setup.seed >>> 0, ships: [...ships(setup.attackers, 'attacker'), ...ships(setup.defenders, 'defender')],
    groups: [], nextGroupId: 1, lastFormations: { attacker: 'line', defender: 'line' },
    cannonballs: [], retreating: false, attackerMultiplier: setup.attackerMultiplier ?? 1, ambush: setup.ambush ?? false, outcome: null, withdrawal: null };
}

const flagshipOrder = (a: BattleShip, b: BattleShip) => Number(!!b.signature) - Number(!!a.signature) || b.maxDurability - a.maxDurability || a.id - b.id;
const groupMembers = (battle: BattleState, group: BattleGroup) => battle.ships.filter(s => s.side === group.side && s.groupId === group.id && active(s)).sort(flagshipOrder);

function refreshGroups(battle: BattleState): void {
  battle.groups = battle.groups.filter(group => {
    const members = groupMembers(battle, group);
    group.shipIds = members.map(s => s.id);
    if (members.length >= 2) { group.leaderId = members[0].id; return true; }
    for (const s of members) {
      delete s.groupId;
      s.order = group.order.type === 'free' ? { type: 'move', x: s.x, y: s.y } : { ...group.order };
    }
    return false;
  });
  for (const s of battle.ships) if (!active(s)) delete s.groupId;
}

function groupOffsets(battle: BattleState, group: BattleGroup) {
  const members = groupMembers(battle, group);
  const spacing = Math.max(0, ...members.map(s => clearance(s) * 2 + 24)) * 1.5;
  const columns = Math.ceil(Math.sqrt(members.length));
  const margin = Math.max(0, ...members.map(clearance));
  const span = Math.min(BATTLE_FIELD.width, BATTLE_FIELD.height) - margin * 2;
  let ranks = 1, bestExtent = Infinity;
  for (let candidate = 1; candidate <= members.length; candidate++) {
    const extent = Math.hypot(Math.ceil(members.length / candidate) - 1, candidate - 1) * spacing;
    if (extent < bestExtent) { ranks = candidate; bestExtent = extent; }
    if (extent <= span) { ranks = candidate; break; }
  }
  const rankSize = Math.ceil(members.length / ranks);
  const across = (i: number) => (i % 2 ? 1 : -1) * Math.ceil(i / 2) * spacing;
  const a = group.heading * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  return members.map((ship, i) => {
    const x = group.formation === 'column' ? -(i % rankSize) * spacing : group.formation === 'spread' ? -Math.floor(i / columns) * spacing : -Math.floor(i / rankSize) * spacing;
    const y = group.formation === 'line' ? across(i % rankSize) : group.formation === 'spread' ? (i % columns) * spacing : across(Math.floor(i / rankSize));
    return { ship, x: x * cos - y * sin, y: x * sin + y * cos };
  });
}

function groupAnchor(battle: BattleState, group: BattleGroup, point: { x: number; y: number }) {
  const offsets = groupOffsets(battle, group);
  return {
    x: clamp(point.x, Math.max(...offsets.map(p => clearance(p.ship) - p.x)), Math.min(...offsets.map(p => BATTLE_FIELD.width - clearance(p.ship) - p.x))),
    y: clamp(point.y, Math.max(...offsets.map(p => clearance(p.ship) - p.y)), Math.min(...offsets.map(p => BATTLE_FIELD.height - clearance(p.ship) - p.y))),
  };
}

export function battleGroupSlots(battle: BattleState, group: BattleGroup) {
  const leader = battle.ships.find(s => s.side === group.side && s.id === group.leaderId)!;
  return groupOffsets(battle, group).map(p => ({ shipId: p.ship.id, x: leader.x + p.x, y: leader.y + p.y }));
}

function moveGroups(battle: BattleState): void {
  for (const group of battle.groups) {
    const members = groupMembers(battle, group), leader = members[0];
    const speed = Math.min(...members.map(s => s.speed)) * 16;
    const order = group.order;
    const target = order.type === 'attack' ? battle.ships.find(s => s.side !== group.side && s.id === order.targetId && active(s)) : undefined;
    if (group.order.type === 'attack' && !target) {
      group.order = { type: 'free' };
      for (const s of members) s.order = { type: 'free' };
    }
    let desired = group.heading, moving = false;
    let goal = { x: leader.x, y: leader.y };
    if (group.order.type === 'move') {
      group.moveHeading ??= bearing(leader, group.order);
      goal = groupAnchor(battle, { ...group, heading: group.moveHeading }, group.order);
      moving = distance(leader, goal) > 1;
      if (moving) desired = group.moveHeading;
    } else if (target) {
      const bow = bearing(leader, target);
      moving = leader.charge || distance(leader, target) > Math.min(...members.map(s => BATTLE_STATS[s.type].range)) * .8;
      desired = moving ? bow : bow + (angle(group.heading - bow) >= 0 ? 90 : -90);
      goal = target;
    }
    const turn = Math.min(BATTLE_STATS[leader.type].turn, ...groupOffsets(battle, group).slice(1).map(p => p.ship.speed * 16 / Math.hypot(p.x, p.y) * 180 / Math.PI));
    group.heading = angle(group.heading + clamp(angle(desired - group.heading), -turn * TICK, turn * TICK));
    const a = (group.order.type === 'move' ? bearing(leader, goal) : group.heading) * Math.PI / 180;
    const slots = battleGroupSlots(battle, group);
    const formed = slots.every(slot => distance(members.find(s => s.id === slot.shipId)!, slot) < 1);
    const anchor = groupAnchor(battle, group, leader);
    const aligned = Math.abs(angle(desired - group.heading)) < .001;
    group.formingTicks = formed || !moving || !aligned ? 0 : (group.formingTicks ?? 0) + 1;
    const travel = moving && aligned && (formed || group.formingTicks >= 3 / TICK)
      ? Math.min(speed * TICK * (formed ? 1 : .5), distance(leader, goal)) : 0;
    const next = { x: anchor.x + Math.cos(a) * travel, y: anchor.y + Math.sin(a) * travel };
    const dx = clamp(next.x - leader.x, -speed * TICK, speed * TICK), dy = clamp(next.y - leader.y, -speed * TICK, speed * TICK);
    const length = Math.hypot(dx, dy), scale = length > speed * TICK ? speed * TICK / length : 1;
    leader.vx = dx * scale / TICK; leader.vy = dy * scale / TICK;
    leader.x += leader.vx * TICK; leader.y += leader.vy * TICK; leader.heading = group.heading;
    for (const slot of battleGroupSlots(battle, group).slice(1)) {
      const s = members.find(s => s.id === slot.shipId)!;
      const ex = slot.x - s.x, ey = slot.y - s.y;
      let vx = ex / TICK, vy = ey / TICK;
      const error = Math.hypot(ex - leader.vx * TICK, ey - leader.vy * TICK);
      const limit = error < 1 ? speed : s.speed * 16;
      const magnitude = Math.hypot(vx, vy);
      if (magnitude > limit) { vx *= limit / magnitude; vy *= limit / magnitude; }
      if (error >= 1 && magnitude > 0) {
        const length = Math.hypot(ex, ey), ux = ex / length, uy = ey / length;
        const obstacle = battle.ships.filter(other => other !== s && active(other)).map(other => {
          const dx = other.x - s.x, dy = other.y - s.y;
          return { other, along: dx * ux + dy * uy, across: dx * -uy + dy * ux, radius: clearance(s) + clearance(other) + 8 };
        }).filter(p => p.along > 0 && p.along < Math.min(length, p.radius + limit / 2) && Math.abs(p.across) < p.radius)
          .sort((a, b) => a.along - b.along || a.other.id - b.other.id)[0];
        if (obstacle) {
          const side = obstacle.across > 1 ? -1 : 1;
          const radius = clearance(s);
          const dx = clamp(obstacle.other.x - uy * side * obstacle.radius * 1.2, radius, BATTLE_FIELD.width - radius) - s.x;
          const dy = clamp(obstacle.other.y + ux * side * obstacle.radius * 1.2, radius, BATTLE_FIELD.height - radius) - s.y;
          const distance = Math.hypot(dx, dy);
          if (distance > .001) {
            const scale = Math.min(limit, distance / TICK) / distance;
            vx = dx * scale; vy = dy * scale;
          }
        }
      }
      const desiredHeading = error < 8 || magnitude < 1 ? group.heading : Math.atan2(vy, vx) * 180 / Math.PI;
      s.heading = angle(s.heading + clamp(angle(desiredHeading - s.heading), -BATTLE_STATS[s.type].turn * TICK, BATTLE_STATS[s.type].turn * TICK));
      s.vx = vx; s.vy = vy; s.x += vx * TICK; s.y += vy * TICK;
    }
  }
}

function withdraw(battle: BattleState, withdrawal: BattleWithdrawal): void {
  battle.withdrawal = withdrawal;
  battle.retreating = true;
  battle.outcome = withdrawal.side === 'attacker' ? 'defeat' : 'victory';
}

function resolveWithdrawal(battle: BattleState): void {
  const fleets = (['attacker', 'defender'] as const).map((side) => ({ side, fleet: battle.ships.filter((s) => s.side === side && s.startedAfloat) }));
  for (const { side, fleet } of fleets) {
    if (!fleet.length) { battle.outcome = side === 'attacker' ? 'defeat' : 'victory'; return; }
  }
  for (const { side, fleet } of fleets) {
    if (!fleet.some((s) => !s.sunk)) { battle.outcome = side === 'attacker' ? 'defeat' : 'victory'; return; }
    const reason = withdrawalReason(fleet);
    if (reason) { withdraw(battle, { side, reason }); return; }
  }
}

export function inBroadsideArc(ship: { x: number; y: number; heading: number }, target: { x: number; y: number }): boolean {
  const off = Math.abs(angle(bearing(ship, target) - ship.heading));
  return off >= 30 && off <= 150;
}

export function issueCommand(battle: BattleState, side: BattleSide, cmd: BattleCommand): void {
  if (battle.outcome || (side !== 'attacker' && side !== 'defender')) return;
  if (cmd.type === 'retreat') {
    withdraw(battle, { side, reason: 'retreat' });
    return;
  }
  if (cmd.type === 'move' && (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y))) return;
  if (cmd.type === 'attack' && !battle.ships.some((s) => s.id === cmd.targetId && s.side !== side && active(s))) return;
  const ships = battle.ships.filter((s) => s.side === side && active(s) && cmd.shipIds.includes(s.id));
  if (!ships.length) return;
  for (const s of ships) delete s.groupId;
  refreshGroups(battle);
  const formation = cmd.formation ?? battle.lastFormations[side];
  battle.lastFormations[side] = formation;
  const order: BattleOrder = cmd.type === 'move' ? { type: 'move', x: cmd.x, y: cmd.y } : cmd.type === 'attack' ? { type: 'attack', targetId: cmd.targetId } : { type: 'free' };
  if (ships.length >= 2) {
    const leader = [...ships].sort(flagshipOrder)[0];
    const group: BattleGroup = { id: battle.nextGroupId++, side, shipIds: ships.map(s => s.id), formation, leaderId: leader.id, heading: leader.heading, order };
    if (order.type === 'move') group.moveHeading = distance(leader, order) > 1 ? bearing(leader, order) : leader.heading;
    battle.groups.push(group);
    for (const s of ships) { s.groupId = group.id; s.order = { ...order }; s.charge = false; }
    return;
  }
  const spacing = Math.max(0, ...ships.map((s) => clearance(s) * 2 + 24)) * 1.5;
  const columns = Math.ceil(Math.sqrt(ships.length));
  const targets = ships.map((s, i) => {
    const offset = (i - (ships.length - 1) / 2) * spacing;
    return { type: s.type,
      x: cmd.type === 'move' ? cmd.x + (cmd.formation === 'line' ? offset : cmd.formation === 'spread' ? (i % columns - (columns - 1) / 2) * spacing : 0) : s.x,
      y: cmd.type === 'move' ? cmd.y + (cmd.formation === 'line' ? 0 : cmd.formation === 'spread' ? (Math.floor(i / columns) - (Math.ceil(ships.length / columns) - 1) / 2) * spacing : offset) : s.y };
  });
  if (cmd.type === 'move') {
    const holding = battle.ships.filter((s) => s.side === side && active(s) && s.groupId === undefined && !ships.includes(s) && s.order.type === 'move');
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
  if (difficulty === 'hard' && total(own) < total(enemies) * 0.35) { issueCommand(battle, side, { type: 'retreat' }); return; }
  const leader = [...own].sort(flagshipOrder)[0];
  if (!leader) return;
  const target = [...enemies].sort(difficulty === 'easy' ? (a, b) => distance(leader, a) - distance(leader, b) : (a, b) => a.durability - b.durability || a.id - b.id)[0];
  const attacking: BattleShip[] = [];
  for (const s of own) {
    if (difficulty === 'hard' && (s.durability < s.maxDurability * 0.3 || s.type === 'cargo')) {
      issueCommand(battle, side, { type: 'move', shipIds: [s.id], x: s.x + (s.x - target.x), y: s.y + (s.y - target.y) });
    } else {
      attacking.push(s);
    }
  }
  if (attacking.length) {
    issueCommand(battle, side, { type: 'attack', shipIds: attacking.map(s => s.id), targetId: target.id });
    for (const s of attacking) s.charge = difficulty === 'easy';
  }
}

export function stepBattle(battle: BattleState, controllers: BattleControllers = {}): void {
  if (battle.outcome) return;
  resolveWithdrawal(battle);
  if (battle.outcome) return;
  refreshGroups(battle);
  for (const side of ['attacker', 'defender'] as const) {
    if (controllers[side]) battleAI(battle, side, controllers[side]);
    if (battle.outcome) return;
  }
  moveGroups(battle);
  for (const s of battle.ships.filter(active)) {
    if (s.groupId !== undefined) { s.reload = Math.max(0, s.reload - TICK); continue; }
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
    s.vx = moving ? Math.cos(s.heading * Math.PI / 180) * s.speed * 16 : 0;
    s.vy = moving ? Math.sin(s.heading * Math.PI / 180) * s.speed * 16 : 0;
    s.x = clamp(s.x + s.vx * TICK, battle.retreating && s.side === 'attacker' ? -100 : stats.radius, BATTLE_FIELD.width - stats.radius);
    s.y = clamp(s.y + s.vy * TICK, stats.radius, BATTLE_FIELD.height - stats.radius);
    if (s.x < 0) { s.escaped = true; continue; }
    s.reload = Math.max(0, s.reload - TICK);
  }
  separate(battle.ships.filter(active), 0, battle.retreating, battle.groups);
  for (const s of battle.ships.filter(active)) {
    if (s.reload > 0 || (s.side === 'defender' && battle.ambush && battle.tick < 8 / TICK)) continue;
    const stats = BATTLE_STATS[s.type];
    const targets = battle.ships.filter((e) => e.side !== s.side && active(e) && distance(s, e) <= stats.range && inBroadsideArc(s, e))
      .sort((a, b) => distance(s, a) - distance(s, b));
    const order = s.order;
    const target = (order.type === 'attack' ? targets.find((e) => e.id === order.targetId) : undefined) ?? targets[0];
    if (!target) continue;
    const flight = distance(s, target) / CANNONBALL_SPEED;
    const landingX = target.x + target.vx * flight + (random(battle) - 0.5) * 18;
    const landingY = target.y + target.vy * flight + (random(battle) - 0.5) * 18;
    battle.cannonballs.push({ side: s.side, x: s.x, y: s.y, landingX, landingY,
      remaining: Math.hypot(landingX - s.x, landingY - s.y) / CANNONBALL_SPEED,
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
    if (hit) {
      const fleet = battle.ships.filter((s) => s.side === hit.side && s.startedAfloat);
      const capped = fleet.filter((s) => s.sunk).length >= sinkingCap(fleet);
      hit.durability = Math.max(capped ? 1 : 0, hit.durability - ball.damage);
      hit.sunk = hit.durability === 0;
    }
  }
  battle.cannonballs = battle.cannonballs.filter((b) => b.remaining > 0);
  battle.tick++;
  refreshGroups(battle);
  resolveWithdrawal(battle);
  if (!battle.outcome && battle.tick >= 1800) battle.outcome = 'draw';
}

export function battleResult(battle: BattleState): RealtimeBattleResult {
  if (!battle.outcome) throw new Error('Battle is not finished');
  return { outcome: battle.outcome, ticks: battle.tick, ...(battle.withdrawal ? { withdrawal: battle.withdrawal } : {}),
    durability: battle.ships.map((s) => ({ id: s.id, side: s.side, durability: s.durability })),
    attackerSunk: battle.ships.filter((s) => s.side === 'attacker' && s.startedAfloat && s.sunk).map((s) => s.id),
    defenderSunk: battle.ships.filter((s) => s.side === 'defender' && s.startedAfloat && s.sunk).map((s) => s.id) };
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
