import Phaser from 'phaser';
import { TICK, playerName, shipName, type BattleShip, type Formation } from '@happy-voyage/shared';
import { getLocale, pick } from '../../i18n';
import { gameController } from '../GameController';
import { BattleSession } from '../BattleSession';
import { sfx } from '../sfx';
import { shipTexture } from '../nauticalArt';

const font = '"Sea Names", Georgia, serif';
const text = (en: string, zh: string) => pick(getLocale(), en, zh);
type Effect = { x: number; y: number; age: number; damage: number };

export class BattleScene extends Phaser.Scene {
  private session!: BattleSession;
  private field!: Phaser.GameObjects.Container;
  private ink!: Phaser.GameObjects.Graphics;
  private health!: Phaser.GameObjects.Graphics;
  private hudInk!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Text[] = [];
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private ships = new Map<number, Phaser.GameObjects.Image>();
  private selected = new Set<number>();
  private formation: Formation = 'column';
  private paused = false;
  private accumulator = 0;
  private previous = new Map<number, { x: number; y: number; heading: number }>();
  private sunkAt = new Map<number, number>();
  private effects: Effect[] = [];
  private clock = 0;
  private endedAt: number | null = null;
  private completed = false;
  private drag: { x: number; y: number } | null = null;
  private cursor = { x: 0, y: 0 };
  private marker: { x: number; y: number } | null = null;

  constructor() { super('Battle'); }

  create() {
    const state = gameController.state!;
    this.session = new BattleSession(state.pendingBattle!, state.players);
    this.labels.clear(); this.ships.clear(); this.selected.clear(); this.previous.clear(); this.sunkAt.clear();
    this.buttons = []; this.effects = []; this.clock = 0; this.endedAt = null; this.completed = false;
    this.accumulator = 0; this.paused = false; this.drag = null; this.marker = null; this.formation = 'column';
    this.cameras.main.setBackgroundColor('#041b2d');
    this.field = this.add.container();
    this.ink = this.add.graphics(); this.field.add(this.ink);
    this.hudInk = this.add.graphics();
    for (const s of this.session.battle.ships) {
      const pending = state.pendingBattle!;
      const owner = s.side === 'attacker' ? pending.attacker : pending.defender;
      const color = owner === null ? 0xc33535 : state.players[owner].color;
      const image = this.add.image(0, 0, shipTexture(this, color)).setTint(color).setDisplaySize(80, 76);
      this.field.add(image); this.ships.set(s.id, image);
      const label = this.add.text(0, 0, '', { fontFamily: font, fontSize: '19px', color: '#fff4d5', stroke: '#062335', strokeThickness: 4 }).setOrigin(.5, 0);
      label.setDepth(1);
      this.field.add(label); this.labels.set(s.id, label);
    }
    this.field.sort('depth');
    this.health = this.add.graphics(); this.field.add(this.health);
    const style = { fontFamily: font, fontSize: '18px', color: '#ffedbb', align: 'center' };
    this.hud = this.add.text(0, 12, '', style).setOrigin(.5, 0);
    this.help = this.add.text(0, 0, '', { ...style, fontSize: '13px', color: '#aed0dd' }).setOrigin(.5, 0);
    this.banner = this.add.text(0, 0, '', { ...style, fontSize: '38px', backgroundColor: '#071e30', padding: { x: 28, y: 20 } }).setOrigin(.5).setVisible(false);
    const actions = [
      () => this.selectAll(),
      ...(['column', 'line', 'spread'] as const).map((f) => () => { this.formation = f; }),
      () => { if (!this.session.battle.outcome) this.paused = !this.paused; },
      () => this.session.command({ type: 'retreat' }),
    ];
    actions.forEach((action, i) => {
      if (i === 5 && this.session.side !== 'attacker') return;
      const b = this.add.text(0, 0, '', { ...style, fontSize: '15px', backgroundColor: '#163e54', padding: { x: 10, y: 10 } }).setOrigin(.5).setInteractive({ useHandCursor: true });
      b.on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); if (!this.session.battle.outcome) action(); });
      this.buttons.push(b);
    });
    this.selectAll();
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.pointerDown, this);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { this.cursor = this.point(p); });
    this.input.on('pointerup', this.pointerUp, this);
    const key = (e: KeyboardEvent) => {
      if (e.repeat || this.session.battle.outcome) return;
      if (e.key.toLowerCase() === 'a') this.selectAll();
      if (e.key === ' ') { e.preventDefault(); this.paused = !this.paused; }
      if (['1', '2', '3'].includes(e.key)) this.formation = (['column', 'line', 'spread'] as const)[Number(e.key) - 1];
    };
    this.input.keyboard?.on('keydown', key);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown', key));
  }

  private selectAll() {
    this.selected = new Set(this.session.battle.ships.filter((s) => s.side === this.session.side && !s.sunk && !s.escaped).map((s) => s.id));
  }

  private point(p: Phaser.Input.Pointer) { return { x: (p.x - this.field.x) / this.field.scaleX, y: (p.y - this.field.y) / this.field.scaleY }; }
  private shipAt(p: { x: number; y: number }) {
    return this.session.battle.ships.filter((s) => !s.sunk && !s.escaped && Math.hypot(s.x - p.x, s.y - p.y) < 38)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  }

  private order(p: { x: number; y: number }, target?: BattleShip) {
    if (!this.selected.size || this.paused || this.session.battle.outcome) return;
    const shipIds = [...this.selected];
    if (target && target.side !== this.session.side) this.session.command({ type: 'attack', shipIds, targetId: target.id });
    else { this.session.command({ type: 'move', shipIds, ...p, formation: this.formation }); this.marker = p; }
  }

  private pointerDown(p: Phaser.Input.Pointer) {
    const point = this.point(p);
    if (point.x < 0 || point.x > 1600 || point.y < 0 || point.y > 900 || this.session.battle.outcome) return;
    const target = this.shipAt(point);
    if (p.rightButtonDown()) { this.order(point, target); return; }
    if (p.wasTouch && (!target || target.side !== this.session.side)) { this.order(point, target); return; }
    this.drag = point; this.cursor = point;
  }

  private pointerUp(p: Phaser.Input.Pointer) {
    if (!this.drag) return;
    const start = this.drag; this.drag = null;
    const end = this.point(p);
    this.selected.clear();
    if (Math.hypot(start.x - end.x, start.y - end.y) > 15) {
      for (const s of this.session.battle.ships) if (s.side === this.session.side && !s.sunk && !s.escaped && s.x >= Math.min(start.x, end.x) && s.x <= Math.max(start.x, end.x) && s.y >= Math.min(start.y, end.y) && s.y <= Math.max(start.y, end.y)) this.selected.add(s.id);
    } else {
      const s = this.shipAt(end);
      if (s?.side === this.session.side) this.selected.add(s.id);
    }
  }

  update(_time: number, delta: number) {
    if (!this.session) return;
    const dt = Math.min(delta / 1000, .25);
    this.clock += dt;
    if (!this.paused && !this.session.battle.outcome) {
      this.accumulator += dt;
      while (this.accumulator >= TICK && !this.session.battle.outcome) {
        const b = this.session.battle;
        const old = b.ships.map((s) => ({ ...s }));
        this.previous = new Map(old.map((s) => [s.id, s]));
        const balls = [...b.cannonballs];
        this.session.step();
        if (b.ships.some((s, i) => s.reload > old[i].reload)) sfx.cannon();
        for (const s of b.ships) {
          const before = old.find((o) => o.id === s.id)!;
          if (s.durability < before.durability) { this.effects.push({ x: s.x, y: s.y, age: 0, damage: before.durability - s.durability }); sfx.splash(); }
          if (s.sunk && !before.sunk) this.sunkAt.set(s.id, this.clock);
        }
        for (const ball of balls) if (ball.remaining <= TICK && !b.ships.some((s, i) => s.durability < old[i].durability && Math.hypot(s.x - ball.landingX, s.y - ball.landingY) < 30)) this.effects.push({ x: ball.landingX, y: ball.landingY, age: 0, damage: 0 });
        this.accumulator -= TICK;
      }
    }
    for (const e of this.effects) e.age += dt;
    this.effects = this.effects.filter((e) => e.age < 1.2);
    if (this.session.battle.outcome && this.endedAt === null) this.endedAt = this.clock;
    this.draw();
    if (this.endedAt !== null && this.clock - this.endedAt > 3.5 && !this.completed) {
      this.completed = true;
      gameController.finishBattle(this.session.log);
    }
  }

  private draw() {
    const { width, height } = this.scale;
    const zoom = Math.min(width / 1600, Math.max(1, height - 190) / 900);
    this.field.setPosition((width - 1600 * zoom) / 2, 86 + (height - 190 - 900 * zoom) / 2).setScale(zoom);
    const g = this.ink.clear();
    const health = this.health.clear();
    g.fillStyle(0x0c4c66).fillRect(0, 0, 1600, 900);
    g.lineStyle(1, 0x8ac6ca, .12);
    for (let x = 0; x <= 1600; x += 100) g.lineBetween(x, 0, x, 900);
    for (let y = 0; y <= 900; y += 100) g.lineBetween(0, y, 1600, y);
    g.lineStyle(3, 0x9cbabe, .5).strokeRect(0, 0, 1600, 900);
    const state = gameController.state!;
    const pending = state.pendingBattle!;
    const alpha = this.paused || this.session.battle.outcome ? 1 : this.accumulator / TICK;
    const labelBoxes: { x: number; y: number; width: number }[] = [];
    for (const s of this.session.battle.ships) {
      const label = this.labels.get(s.id)!;
      const fade = s.sunk ? Math.max(0, 1 - (this.clock - (this.sunkAt.get(s.id) ?? 0)) / 1.5) : s.escaped ? 0 : 1;
      const old = this.previous.get(s.id) ?? s;
      const x = Phaser.Math.Linear(old.x, s.x, alpha), y = Phaser.Math.Linear(old.y, s.y, alpha);
      const pirate = s.side === 'defender' && pending.defender === null;
      const color = pirate ? 0xb93435 : state.players[s.side === 'attacker' ? pending.attacker : pending.defender!].color;
      if (this.selected.has(s.id) && !s.sunk && !s.escaped) g.lineStyle(3, 0xffde88).strokeEllipse(x, y, 83, 83);
      if (s.signature) g.lineStyle(3, 0xffd65d, fade).strokeEllipse(x, y, 72, 64);
      const flash = this.effects.some((e) => e.damage && e.age < .2 && Math.hypot(e.x - s.x, e.y - s.y) < 30);
      const turn = Phaser.Math.Angle.WrapDegrees(s.heading - old.heading);
      this.ships.get(s.id)!.setPosition(x, y).setAngle(old.heading + turn * alpha + (s.sunk ? (1 - fade) * 70 : 0)).setAlpha(fade).setTint(flash ? 0xff3333 : color);
      label.setText(pirate ? text('Pirate', '海盗') : shipName(s.name, getLocale()));
      let labelY = y + 44;
      while (labelBoxes.some((b) => Math.abs(b.x - x) < (b.width + label.width) / 2 + 8 && Math.abs(b.y - labelY) < 33)) labelY += 34;
      if (fade > 0) labelBoxes.push({ x, y: labelY, width: label.width });
      label.setPosition(x, labelY).setAlpha(fade);
      if (!s.sunk && !s.escaped) {
        if (labelY > y + 44) health.lineStyle(1, 0xb5d0d2, .5).lineBetween(x, y + 32, x, labelY - 9);
        health.fillStyle(0x051b29).fillRect(x - 32, labelY - 9, 64, 7);
        health.fillStyle(color).fillRect(x - 32, labelY - 9, 64 * Math.min(1, s.durability / s.maxDurability), 7);
      }
    }
    for (const b of this.session.battle.cannonballs) g.fillStyle(0xffefb1).fillCircle(b.x, b.y, 5);
    for (const e of this.effects) {
      g.lineStyle(3, e.damage ? 0xffbd5c : 0xa6ecff, 1 - e.age / 1.2).strokeCircle(e.x, e.y, 8 + e.age * 35);
      if (e.damage) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.lineBetween(e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, e.x + Math.cos(a) * (20 + e.age * 45), e.y + Math.sin(a) * (20 + e.age * 45)); }
    }
    // Floating numbers share the field transform with the ships.
    this.field.getAll('name', 'damage').forEach((o) => (o as Phaser.GameObjects.Text).destroy());
    for (const e of this.effects.filter((e) => e.damage)) this.field.add(this.add.text(e.x, e.y - 35 - e.age * 38, `−${e.damage}`, { fontFamily: font, fontSize: '24px', color: '#ffb39b' }).setOrigin(.5).setAlpha(1 - e.age / 1.2).setName('damage'));
    if (this.marker) g.lineStyle(3, 0xffe39a, .8).strokeCircle(this.marker.x, this.marker.y, 16).lineBetween(this.marker.x - 24, this.marker.y, this.marker.x + 24, this.marker.y).lineBetween(this.marker.x, this.marker.y - 24, this.marker.x, this.marker.y + 24);
    if (this.drag) g.lineStyle(2, 0xffe5a4).strokeRect(Math.min(this.drag.x, this.cursor.x), Math.min(this.drag.y, this.cursor.y), Math.abs(this.drag.x - this.cursor.x), Math.abs(this.drag.y - this.cursor.y));
    const totals = (side: 'attacker' | 'defender') => this.session.battle.ships.filter((s) => s.side === side).reduce((sum, s) => sum + s.durability, 0);
    const a = playerName(state.players[pending.attacker], getLocale());
    const d = pending.defender === null ? text('Pirates', '海盗') : playerName(state.players[pending.defender], getLocale());
    this.hud.setPosition(width / 2, 10).setFontSize(width < 600 ? 14 : 18).setText(`${a}  ${totals('attacker')}     ·     ${Math.max(0, Math.ceil(90 - this.session.battle.tick * TICK))}s     ·     ${d}  ${totals('defender')}`);
    const barWidth = Math.min(260, width * .28);
    const hudGraphics = this.hudInk.clear();
    for (const [i, side] of (['attacker', 'defender'] as const).entries()) {
      const max = this.session.battle.ships.filter((s) => s.side === side).reduce((sum, s) => sum + s.maxDurability, 0);
      const x = i ? width - barWidth - 16 : 16;
      hudGraphics.fillStyle(0x193548).fillRect(x, 42, barWidth, 7).fillStyle(i ? 0xe07d70 : 0x70c5b0).fillRect(x, 42, barWidth * Math.min(1, totals(side) / Math.max(1, max)), 7);
    }
    const names = [text('Whole fleet [A]', '全舰队 [A]'), text('Column [1]', '纵队 [1]'), text('Line [2]', '横队 [2]'), text('Spread [3]', '散开 [3]'), this.paused ? text('Resume', '继续') : text('Pause [Space]', '暂停 [空格]'), text('Retreat', '撤退')];
    const cols = width < 650 ? 3 : this.buttons.length;
    this.buttons.forEach((b, i) => b.setText(names[i]).setPosition(width / 2 + ((i % cols) - (cols - 1) / 2) * Math.min(155, width / cols), height - (width < 650 ? 76 : 53) + Math.floor(i / cols) * 40).setBackgroundColor(i >= 1 && i <= 3 && (['column', 'line', 'spread'][i - 1] === this.formation) ? '#725d30' : '#163e54'));
    this.help.setPosition(width / 2, 62).setText(text('Select · Right-click to order / Tap sea to move · Broadside auto-fire', '选择舰船 · 右键下令／点击海面移动 · 侧舷自动开火')).setFontSize(width < 600 ? 10 : 13);
    const outcome = this.session.battle.outcome;
    if (outcome && this.endedAt !== null && this.clock - this.endedAt >= 1.5) {
      const win = outcome === (this.session.side === 'attacker' ? 'victory' : 'defeat');
      this.banner.setPosition(width / 2, height / 2).setText(outcome === 'draw' ? text('Draw', '平局') : win ? text('Victory', '胜利') : text('Defeat', '战败')).setVisible(true);
    } else this.banner.setVisible(this.paused).setPosition(width / 2, height / 2).setText(text('Paused', '已暂停'));
  }
}
