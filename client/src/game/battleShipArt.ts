import type Phaser from 'phaser';
import { SHIP_TYPES, type Ship, type ShipType } from '@happy-voyage/shared';
import { CAMERA_45 } from './battleLayout';

export type ShipGrade = 1 | 2 | 3;
export type ShipAppearance = Pick<Ship, 'type' | 'maxDurability' | 'cargoCapacity' | 'signature'>;
export type Point3 = { x: number; y: number; z: number };
type Material = 'wood' | 'deck' | 'trim' | 'cloth' | 'iron' | 'rope' | 'window' | 'stripe' | 'flag' | 'bone';
export type ShipFace = { points: Point3[]; material: Material; width?: number };
export const HEADING_FRAMES = 32;
export const SHIP_TEXTURE_SIZE = 384;
export const SHIP_WATERLINE = { x: .5, y: 2 / 3 };

export const SHIP_VARIANTS = {
  warship: [
    { name: 'sloop-of-war', beam: 20, masts: 2, decks: 1, castle: 7, lateen: false },
    { name: 'frigate', beam: 23, masts: 3, decks: 1, castle: 13, lateen: false },
    { name: 'ship-of-the-line', beam: 28, masts: 3, decks: 3, castle: 23, lateen: false },
  ],
  cargo: [
    { name: 'fluyt', beam: 29, masts: 2, decks: 0, castle: 12, lateen: false },
    { name: 'merchantman', beam: 32, masts: 3, decks: 0, castle: 16, lateen: false },
    { name: 'galleon', beam: 30, masts: 4, decks: 1, castle: 30, lateen: true },
  ],
  explorer: [
    { name: 'caravel', beam: 16, masts: 2, decks: 0, castle: 6, lateen: true },
    { name: 'caravela-redonda', beam: 19, masts: 2, decks: 0, castle: 11, lateen: true },
    { name: 'carrack', beam: 22, masts: 3, decks: 0, castle: 19, lateen: false },
  ],
} as const;

export function shipGrade(ship: ShipAppearance): ShipGrade {
  const base = SHIP_TYPES[ship.type];
  const ratio = Math.max(ship.maxDurability / base.maxDurability, ship.cargoCapacity / base.cargoCapacity);
  return ship.signature || ratio > 1.4 ? 3 : ratio > 1.15 ? 2 : 1;
}

export function shipStyle(ship: ShipAppearance) {
  const grade = shipGrade(ship);
  return { grade, variant: SHIP_VARIANTS[ship.type][grade - 1].name, scale: [.85, 1, 1.15][grade - 1] };
}

export const headingFrame = (heading: number) => ((Math.round(heading / 360 * HEADING_FRAMES) % HEADING_FRAMES) + HEADING_FRAMES) % HEADING_FRAMES;
const models = new Map<string, ReturnType<typeof buildShipModel>>();

export function shipModel(type: ShipType, grade: ShipGrade) {
  const key = `${type}-${grade}`;
  if (!models.has(key)) models.set(key, buildShipModel(type, grade));
  return models.get(key)!;
}

function buildShipModel(type: ShipType, grade: ShipGrade) {
  const d = SHIP_VARIANTS[type][grade - 1], scale = [.85, 1, 1.15][grade - 1];
  const faces: ShipFace[] = [], ports: Point3[] = [];
  const p = (x: number, y: number, z: number): Point3 => ({ x: x * scale, y: y * scale, z: z * scale });
  const face = (material: Material, points: Point3[], width?: number) => faces.push({ material, points, ...(width ? { width } : {}) });
  const line = (material: Material, a: Point3, b: Point3, width = 1) => face(material, [a, b], width);
  const deck = 17 + d.decks * 5;
  const outline = [[-60, -.62], [-47, -.94], [-20, -1], [20, -.87], [47, -.5], [65, 0], [47, .5], [20, .87], [-20, 1], [-47, .94], [-60, .62]];
  const sheer = (x: number) => 5 * (Math.abs(x) / 65) ** 2;
  const ring = (level: number) => outline.map(([x, y]) => p(x * (.9 + level * .1), y * d.beam * (.65 + level * .35), deck * level + sheer(x)));
  for (let plank = 0; plank < 5; plank++) {
    const low = ring(plank / 5), high = ring((plank + 1) / 5);
    for (let i = 0; i < low.length; i++) face(plank === 4 ? 'trim' : 'wood', [low[i], low[(i + 1) % low.length], high[(i + 1) % low.length], high[i]]);
  }
  face('deck', ring(1));
  for (let y = -d.beam * .65; y <= d.beam * .65; y += 4) line('wood', p(-49, y, deck + 2), p(34, y, deck + 1), .45);
  const box = (x: number, y: number, z: number, length: number, beam: number, height: number) => {
    const a = [p(x, y, z), p(x + length, y, z), p(x + length, y + beam, z), p(x, y + beam, z)];
    const b = a.map(v => ({ ...v, z: v.z + height * scale }));
    for (let i = 0; i < 4; i++) face('wood', [a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]]);
    face('deck', b);
    for (let i = 0; i < 4; i++) line('trim', b[i], b[(i + 1) % 4], 1.4);
  };
  box(-58, -d.beam * .58, deck + 3, 24, d.beam * 1.16, d.castle);
  if (grade === 3) box(35, -d.beam * .4, deck + 3, 17, d.beam * .8, d.castle * .6);
  box(-10, -6, deck + 1, 16, 12, 3);
  for (let i = 0; i < (grade === 3 ? 5 : 3); i++) {
    const y = (i - (grade === 3 ? 2 : 1)) * d.beam * .2;
    face('window', [p(-58.5, y - 2, deck + d.castle * .5), p(-58.5, y + 2, deck + d.castle * .5), p(-58.5, y + 2, deck + d.castle * .5 + 5), p(-58.5, y - 2, deck + d.castle * .5 + 5)]);
  }
  const gunXs = type === 'warship' ? [-43, -26, -9, 8, 25, 40] : [-27, 22];
  for (let row = 0; row < Math.max(1, d.decks); row++) for (const x of gunXs) for (const side of [-1, 1]) {
    const y = side * d.beam * (x > 20 ? .72 : .95), z = 8 + row * 8;
    if (d.decks === 3) face('stripe', [p(x - 8, y, z - 3.5), p(x + 8, y, z - 3.5), p(x + 8, y, z + 3.5), p(x - 8, y, z + 3.5)]);
    face('iron', [p(x - 2.8, y + side * .3, z - 2), p(x + 2.8, y + side * .3, z - 2), p(x + 2.8, y + side * .3, z + 2), p(x - 2.8, y + side * .3, z + 2)]);
    const muzzle = p(x, y + side * 5, z);
    line('iron', p(x, y, z), muzzle, 2);
    if (row === 0 && gunXs.indexOf(x) % 2 === 0) ports.push(muzzle);
  }
  const mastXs = d.masts === 2 ? [-25, 27] : d.masts === 3 ? [-37, 0, 37] : [-43, -15, 15, 42];
  let mastHeight = 0;
  for (const [index, x] of mastXs.entries()) {
    const top = deck + 64 + grade * 9 - (index === 0 ? 12 : 0);
    mastHeight = Math.max(mastHeight, (top + 4) * scale);
    for (let side = 0; side < 6; side++) {
      const a = side * Math.PI / 3, b = (side + 1) * Math.PI / 3;
      face('wood', [p(x + Math.cos(a) * 1.6, Math.sin(a) * 1.6, deck), p(x + Math.cos(b) * 1.6, Math.sin(b) * 1.6, deck), p(x + Math.cos(b) * .8, Math.sin(b) * .8, top), p(x + Math.cos(a) * .8, Math.sin(a) * .8, top)]);
    }
    for (const side of [-1, 1]) line('rope', p(x, 0, top - 4), p(x - 17, side * d.beam * .85, deck + 2), .55);
    const lateen = d.lateen && (type === 'cargo' ? index < 2 : grade === 1 || index === 0);
    if (lateen) {
      line('wood', p(x - 24, -18, deck + 24), p(x + 23, 18, top - 4), 2);
      face('cloth', [p(x - 23, -17, deck + 25), p(x + 22, 17, top - 6), p(x + 18, -18, deck + 20)]);
    } else for (let tier = 0; tier < (grade === 3 ? 3 : 2); tier++) {
      const z = top - 8 - tier * 24, span = (17 + tier * 8) * (type === 'explorer' ? .85 : 1);
      line('wood', p(x, -span - 3, z), p(x, span + 3, z), 1.8);
      for (const side of [-1, 1]) face('cloth', [p(x, side * span, z - 1), p(x + 5, 0, z - 3), p(x + 10, 0, z - 24), p(x + 4, side * span * .86, z - 21)]);
    }
    face('flag', [p(x, 0, top + 4), p(x - 17, 0, top + 1), p(x - 15, 0, top - 9), p(x, 0, top - 6)]);
    face('bone', [p(x - 7, -.1, top - 1), p(x - 10, -.1, top - 3), p(x - 7, -.1, top - 6), p(x - 4, -.1, top - 3)]);
    line('bone', p(x - 12, -.2, top - 7), p(x - 3, -.2, top), .8);
    line('bone', p(x - 12, -.2, top), p(x - 3, -.2, top - 7), .8);
  }
  line('wood', p(52, 0, deck + 2), p(88, 0, deck + 17), 3);
  line('rope', p(86, 0, deck + 16), p(27, 0, deck + 60), .6);
  return { faces, ports, mastHeight, variant: d.name, grade, scale };
}

export function projectShipPoint(p: Point3, heading: number) {
  const a = heading * Math.PI / 180, x = p.x * Math.cos(a) - p.y * Math.sin(a), y = p.x * Math.sin(a) + p.y * Math.cos(a);
  return { x, y: (y - p.z) * CAMERA_45, depth: (y + p.z) * CAMERA_45 };
}

function lit(color: number, factor: number) {
  return `rgb(${[color >> 16, (color >> 8) & 255, color & 255].map(v => Math.min(255, Math.round(v * factor))).join(',')})`;
}

export function drawShipModel(ctx: CanvasRenderingContext2D, model: ReturnType<typeof shipModel>, color: number, heading: number, pirate = false, signature = false) {
  const palette: Record<Material, number> = { wood: 0x966039, deck: 0xcba573, trim: signature ? 0xf4cf70 : 0x593c2a, cloth: pirate ? 0x24232a : color, iron: 0x242b30, rope: 0x413a30, window: 0x83bec0, stripe: 0xe4d6ac, flag: pirate ? 0x191c24 : color, bone: 0xeee5cf };
  ctx.save(); ctx.shadowColor = '#00151f88'; ctx.shadowBlur = 7; ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = i * Math.PI / 16, p = projectShipPoint({ x: Math.cos(a) * 69 * model.scale, y: Math.sin(a) * 31 * model.scale, z: -2 }, heading);
    if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.fillStyle = '#001a2680'; ctx.fill(); ctx.shadowBlur = 0;
  const faces = model.faces.filter(f => pirate || f.material !== 'bone').map(f => ({ ...f, projected: f.points.map(p => projectShipPoint(p, heading)) }));
  faces.sort((a, b) => a.projected.reduce((n, p) => n + p.depth, 0) / a.points.length - b.projected.reduce((n, p) => n + p.depth, 0) / b.points.length);
  for (const f of faces) {
    ctx.beginPath(); f.projected.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    if (f.points.length > 2) {
      ctx.closePath();
      const [a, b, c] = f.points.map(p => projectShipPoint({ ...p, z: 0 }, heading));
      const u = { x: b.x - a.x, y: (b.y - a.y) / CAMERA_45, z: f.points[1].z - f.points[0].z };
      const v = { x: c.x - a.x, y: (c.y - a.y) / CAMERA_45, z: f.points[2].z - f.points[0].z };
      const n = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
      const dot = (-n.x * .35 - n.y * .45 + n.z * .82) / (Math.hypot(n.x, n.y, n.z) || 1);
      const light = f.material === 'cloth' ? Math.abs(dot) : Math.max(0, dot);
      ctx.fillStyle = lit(palette[f.material], .58 + light * .48); ctx.fill();
    }
    ctx.lineWidth = f.width ?? .45;
    ctx.strokeStyle = f.material === 'cloth' ? pirate ? '#b74d46' : '#e9d7af' : lit(palette[f.material], f.width ? .9 : .55);
    ctx.stroke();
  }
  ctx.restore();
}

export function battleShipTexture(scene: Phaser.Scene, ship: ShipAppearance, color: number, pirate = false, heading = 0): string {
  const { variant, grade } = shipStyle(ship), frame = headingFrame(heading);
  const key = `battle-iso-${variant}-${color}-${pirate}-${!!ship.signature}-${frame}`;
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, SHIP_TEXTURE_SIZE, SHIP_TEXTURE_SIZE)!;
  const ctx = texture.getContext();
  const model = shipModel(ship.type, grade), angle = frame * 360 / HEADING_FRAMES;
  ctx.save(); ctx.translate(SHIP_TEXTURE_SIZE / 2, SHIP_TEXTURE_SIZE * SHIP_WATERLINE.y); ctx.scale(1.5, 1.5);
  drawShipModel(ctx, model, color, angle, pirate, !!ship.signature);
  ctx.restore(); texture.refresh();
  const points = model.faces.flatMap(f => f.points).concat([-1, 1].flatMap(x => [-1, 1].map(y => ({ x: x * 69 * model.scale, y: y * 31 * model.scale, z: -2 }))));
  const projected = points.map(p => projectShipPoint(p, angle));
  const left = Math.max(0, Math.floor(SHIP_TEXTURE_SIZE / 2 + Math.min(...projected.map(p => p.x)) * 1.5 - 12));
  const top = Math.max(0, Math.floor(SHIP_TEXTURE_SIZE * SHIP_WATERLINE.y + Math.min(...projected.map(p => p.y)) * 1.5 - 12));
  const right = Math.min(SHIP_TEXTURE_SIZE, Math.ceil(SHIP_TEXTURE_SIZE / 2 + Math.max(...projected.map(p => p.x)) * 1.5 + 12));
  const bottom = Math.min(SHIP_TEXTURE_SIZE, Math.ceil(SHIP_TEXTURE_SIZE * SHIP_WATERLINE.y + Math.max(...projected.map(p => p.y)) * 1.5 + 12));
  const spriteFrame = texture.get();
  spriteFrame.setSize(right - left, bottom - top, left, top);
  spriteFrame.customPivot = true;
  spriteFrame.pivotX = (SHIP_TEXTURE_SIZE / 2 - left) / spriteFrame.width;
  spriteFrame.pivotY = (SHIP_TEXTURE_SIZE * SHIP_WATERLINE.y - top) / spriteFrame.height;
  return key;
}

export async function prewarmBattleShips(scene: Phaser.Scene, ships: { ship: ShipAppearance; color: number; pirate: boolean }[]) {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const unique = new Map(ships.map(s => [`${shipStyle(s.ship).variant}-${s.color}-${s.pirate}-${!!s.ship.signature}`, s]));
  let batch = 0;
  for (const s of unique.values()) for (let frame = 0; frame < HEADING_FRAMES; frame++) {
    if (!scene.sys.isActive()) return;
    battleShipTexture(scene, s.ship, s.color, s.pirate, frame * 360 / HEADING_FRAMES);
    if (++batch % 2 === 0) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
}

export function broadsideMuzzles(ship: ShipAppearance & { x: number; y: number; heading: number }, target: { x: number; y: number }) {
  const a = ship.heading * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
  const side = dx * (target.y - ship.y) - dy * (target.x - ship.x) >= 0 ? 1 : -1;
  return shipModel(ship.type, shipGrade(ship)).ports.filter(p => p.y * side > 0).map(p => ({
    x: ship.x + dx * p.x - dy * p.y, y: ship.y + dy * p.x + dx * p.y, z: p.z, dx: -dy * side, dy: dx * side,
  }));
}
