import Phaser from 'phaser';
import { TICK, playerName, shipName, type BattleShip, type Formation } from '@happy-voyage/shared';
import { getLocale, pick } from '../../i18n';
import { gameController } from '../GameController';
import { BattleSession } from '../BattleSession';
import { sfx } from '../sfx';
import { battleShipTexture, broadsideMuzzles, prewarmBattleShips, shipModel, shipGrade } from '../battleShipArt';
import { battleLayout, battleTapRadius, battleToScreen, isBattleDrag, placeBattleLabel, screenToBattle, type BattleRect } from '../battleLayout';

const font = '"Sea Names", Georgia, serif';
const text = (en: string, zh: string) => pick(getLocale(), en, zh);
type Effect = { x: number; y: number; age: number; damage: number };
type Smoke = { x: number; y: number; z: number; dx: number; dy: number; age: number };

export class BattleScene extends Phaser.Scene {
  private session!: BattleSession;
  private field!: Phaser.GameObjects.Container;
  private ink!: Phaser.GameObjects.Graphics;
  private actionInk!: Phaser.GameObjects.Graphics;
  private flights = new WeakMap<object, number>();
  private health!: Phaser.GameObjects.Graphics;
  private hudInk!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Text[] = [];
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private damageLabels: Phaser.GameObjects.Text[] = [];
  private ships = new Map<number, Phaser.GameObjects.Image>();
  private selected = new Set<number>();
  private formation: Formation = 'column';
  private paused = false;
  private accumulator = 0;
  private previous = new Map<number, { x: number; y: number; heading: number }>();
  private sunkAt = new Map<number, number>();
  private effects: Effect[] = [];
  private smoke: Smoke[] = [];
  private clock = 0;
  private endedAt: number | null = null;
  private completed = false;
  private drag: { x: number; y: number; screenX: number; screenY: number; touch: boolean } | null = null;
  private cursor = { x: 0, y: 0 };
  private marker: { x: number; y: number } | null = null;

  constructor() { super('Battle'); }

  create() {
    const state = gameController.state!;
    this.session = new BattleSession(state.pendingBattle!, state.players);
    this.labels.clear(); this.ships.clear(); this.selected.clear(); this.previous.clear(); this.sunkAt.clear();
    this.damageLabels = [];
    this.buttons = []; this.effects = []; this.smoke = []; this.clock = 0; this.endedAt = null; this.completed = false;
    this.accumulator = 0; this.paused = false; this.drag = null; this.marker = null; this.formation = 'column';
    this.cameras.main.setBackgroundColor('#041b2d');
    this.field = this.add.container();
    this.ink = this.add.graphics().setDepth(-10000); this.field.add(this.ink);
    this.actionInk = this.add.graphics().setDepth(.5);
    this.flights = new WeakMap();
    this.hudInk = this.add.graphics();
    for (const s of this.session.battle.ships) {
      const pending = state.pendingBattle!;
      const owner = s.side === 'attacker' ? pending.attacker : pending.defender;
      const color = owner === null ? 0xc33535 : state.players[owner].color;
      const image = this.add.image(0, 0, battleShipTexture(this, s, color, owner === null));
      this.field.add(image); this.ships.set(s.id, image);
      const label = this.add.text(0, 0, '', { fontFamily: font, fontSize: '19px', color: '#fff4d5', stroke: '#062335', strokeThickness: 4 }).setOrigin(.5, 0);
      label.setDepth(1);
      this.labels.set(s.id, label);
    }
    void prewarmBattleShips(this, this.session.battle.ships.map(ship => {
      const owner = ship.side === 'attacker' ? state.pendingBattle!.attacker : state.pendingBattle!.defender;
      return { ship, color: owner === null ? 0xc33535 : state.players[owner].color, pirate: owner === null };
    }));
    this.field.sort('depth');
    this.health = this.add.graphics();
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
    actions.forEach((action) => {
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

  private layout() { return battleLayout(this.scale.width, this.scale.height); }
  private point(p: Phaser.Input.Pointer) { return screenToBattle(this.layout(), p); }
  private shipAt(p: { x: number; y: number }) {
    const layout = this.layout(), screen = battleToScreen(layout, p);
    const distance = (s: BattleShip) => { const q = battleToScreen(layout, s); return Math.hypot(q.x - screen.x, q.y - screen.y); };
    return this.session.battle.ships.filter((s) => !s.sunk && !s.escaped && distance(s) <= battleTapRadius(layout.zoom) * layout.zoom)
      .sort((a, b) => distance(a) - distance(b))[0];
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
    this.drag = { ...point, screenX: p.x, screenY: p.y, touch: p.wasTouch }; this.cursor = point;
  }

  private pointerUp(p: Phaser.Input.Pointer) {
    if (!this.drag) return;
    const start = this.drag; this.drag = null;
    const end = this.point(p);
    if (isBattleDrag({ x: start.screenX, y: start.screenY }, p)) {
      this.selected.clear();
      for (const s of this.session.battle.ships) if (s.side === this.session.side && !s.sunk && !s.escaped && s.x >= Math.min(start.x, end.x) && s.x <= Math.max(start.x, end.x) && s.y >= Math.min(start.y, end.y) && s.y <= Math.max(start.y, end.y)) this.selected.add(s.id);
    } else {
      const s = this.shipAt(start.touch ? start : end);
      if (start.touch && (!s || s.side !== this.session.side)) { this.order(end, s); return; }
      this.selected.clear();
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
          if (s.reload > before.reload) {
            const shot = b.cannonballs.find((ball) => !balls.includes(ball) && ball.side === s.side && Math.hypot(ball.x - s.x, ball.y - s.y) < 25);
            if (shot) this.smoke.push(...broadsideMuzzles(s, { x: shot.landingX, y: shot.landingY }).map((m) => ({ ...m, age: 0 })));
          }
          if (s.durability < before.durability) { this.effects.push({ x: s.x, y: s.y, age: 0, damage: before.durability - s.durability }); sfx.splash(); }
          if (s.sunk && !before.sunk) this.sunkAt.set(s.id, this.clock);
        }
        for (const ball of balls) if (ball.remaining <= TICK && !b.ships.some((s, i) => s.durability < old[i].durability && Math.hypot(s.x - ball.landingX, s.y - ball.landingY) < 30)) this.effects.push({ x: ball.landingX, y: ball.landingY, age: 0, damage: 0 });
        this.accumulator -= TICK;
      }
    }
    for (const e of this.effects) e.age += dt;
    this.effects = this.effects.filter((e) => e.age < 1.2);
    for (const puff of this.smoke) puff.age += dt;
    this.smoke = this.smoke.filter((puff) => puff.age < 1.1);
    if (this.session.battle.outcome && this.endedAt === null) this.endedAt = this.clock;
    this.draw();
    if (this.endedAt !== null && this.clock - this.endedAt > 3.5 && !this.completed) {
      this.completed = true;
      gameController.finishBattle(this.session.log);
    }
  }

  private draw() {
    const { width, height } = this.scale;
    const layout = this.layout(), { zoom } = layout;
    this.field.setPosition(0, 0).setScale(1).setAngle(0);
    const g = this.ink.clear();
    const fx = this.actionInk.clear();
    const project = (x: number, y: number, z = 0) => battleToScreen(layout, { x, y, z });
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      const a = project(x1, y1), b = project(x2, y2); g.lineBetween(a.x, a.y, b.x, b.y);
    };
    const health = this.health.clear();
    const bounds = layout.bounds;
    g.fillGradientStyle(0x0c435d, 0x12546b, 0x167a88, 0x0a536d).fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    for (let i = 0; i < 90; i++) {
      const phase = this.clock * .65 + i * 2.4;
      const x = (i * 193.7 + this.clock * 6) % 1540 + 20;
      const y = (i * 137.3) % 840 + 30 + Math.sin(phase) * 4;
      g.lineStyle((i % 4 ? 1 : 2) * zoom, 0xb1ece6, .06 + (Math.sin(phase) + 1) * .035);
      line(x - 15, y, x - 5, y + 3); line(x - 5, y + 3, x + 6, y + 2); line(x + 6, y + 2, x + 18, y - 1);
    }
    g.lineStyle(2, 0x9cbabe, .5).strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    const state = gameController.state!;
    const pending = state.pendingBattle!;
    const alpha = this.paused || this.session.battle.outcome ? 1 : this.accumulator / TICK;
    const labelBoxes: BattleRect[] = [];
    for (const s of this.session.battle.ships) {
      const label = this.labels.get(s.id)!;
      const withdrawing = this.session.battle.withdrawal?.side === s.side && this.endedAt !== null;
      const fade = s.sunk ? Math.max(0, 1 - (this.clock - (this.sunkAt.get(s.id) ?? 0)) / 1.5) : s.escaped ? 0
        : withdrawing ? Math.max(0, 1 - (this.clock - this.endedAt!) / 1.5) : 1;
      const old = this.previous.get(s.id) ?? s;
      const x = Phaser.Math.Linear(old.x, s.x, alpha), y = Phaser.Math.Linear(old.y, s.y, alpha);
      const screen = battleToScreen(layout, { x, y });
      const pirate = s.side === 'defender' && pending.defender === null;
      const color = pirate ? 0xb93435 : state.players[s.side === 'attacker' ? pending.attacker : pending.defender!].color;
      if (!s.sunk && !s.escaped && Math.hypot(s.vx, s.vy) > 1) {
        const heading = s.heading * Math.PI / 180;
        const dx = Math.cos(heading), dy = Math.sin(heading);
        for (let i = 0; i < 3; i++) {
          const trail = 30 + i * 16 + (this.clock * 12 % 16);
          const wx = x - dx * trail, wy = y - dy * trail;
          const spread = 8 + i * 5;
          g.lineStyle(2 * zoom, 0xc0eee6, (.19 - i * .05) * fade); line(wx - dy * spread, wy + dx * spread, wx + dy * spread, wy - dx * spread);
        }
      }
      if (this.selected.has(s.id) && !s.sunk && !s.escaped) g.lineStyle(2, 0xffde88, fade).strokeEllipse(screen.x, screen.y, 108 * zoom, 108 * Math.SQRT1_2 * zoom);
      if (s.signature) g.lineStyle(2, 0xffd65d, fade).strokeEllipse(screen.x, screen.y, 94 * zoom, 94 * Math.SQRT1_2 * zoom);
      const flash = this.effects.some((e) => e.damage && e.age < .2 && Math.hypot(e.x - s.x, e.y - s.y) < 30);
      const turn = Phaser.Math.Angle.WrapDegrees(s.heading - old.heading);
      const heading = old.heading + turn * alpha + (layout.portrait ? -90 : 0);
      this.ships.get(s.id)!.setTexture(battleShipTexture(this, s, pirate ? 0xc33535 : color, pirate, heading))
        .setPosition(screen.x, screen.y + (s.sunk ? (1 - fade) * 18 * zoom : 0)).setScale(zoom / 1.5)
        .setAngle(s.sunk ? (1 - fade) * 20 : 0).setDepth(screen.y).setAlpha(fade).setTint(flash ? 0xff7777 : 0xffffff);
      label.setText(pirate ? text('Pirate', '海盗') : shipName(s.name, getLocale()));
      const labelSize = Math.max(11, 19 * zoom);
      label.setFontSize(labelSize);
      const wrapWidth = Math.max(1, layout.bounds.width - 12);
      if (label.style.wordWrapWidth !== wrapWidth) label.setWordWrapWidth(wrapWidth, true);
      const barWidth = Math.max(32, 64 * zoom), barHeight = Math.max(4, 7 * zoom);
      const mast = project(x, y, shipModel(s.type, shipGrade(s)).mastHeight + 38);
      const box = placeBattleLabel(layout.bounds, labelBoxes, { x: mast.x, y: mast.y - label.height - barHeight - 8 }, { width: Math.max(label.width, barWidth), height: label.height + barHeight + 2 }, 0);
      const labelX = box.x + box.width / 2, labelY = box.y + barHeight + 2;
      if (fade > 0) labelBoxes.push(box);
      label.setPosition(labelX, labelY).setAlpha(fade);
      if (!s.sunk && !s.escaped && fade > 0) {
        if (Math.abs(labelX - screen.x) > 12) health.lineStyle(1, 0xb5d0d2, .35 * fade).lineBetween(mast.x, mast.y + 10, labelX, box.y + box.height);
        health.fillStyle(0x051b29, fade).fillRect(labelX - barWidth / 2, labelY - barHeight - 2, barWidth, barHeight);
        health.fillStyle(color, fade).fillRect(labelX - barWidth / 2, labelY - barHeight - 2, barWidth * Math.min(1, s.durability / s.maxDurability), barHeight);
      }
    }
    this.field.sort('depth');
    for (const b of this.session.battle.cannonballs) {
      if (!this.flights.has(b)) this.flights.set(b, b.remaining + TICK);
      const t = Phaser.Math.Clamp(1 - (b.remaining - alpha * TICK) / this.flights.get(b)!, 0, 1);
      const shadow = project(b.x, b.y), ball = project(b.x, b.y, 4 * 85 * t * (1 - t));
      fx.fillStyle(0x001926, .45).fillEllipse(shadow.x, shadow.y, 8 * zoom, 5 * zoom);
      fx.fillStyle(0xffefb1).fillCircle(ball.x, ball.y, Math.max(2, 4 * zoom));
    }
    for (const puff of this.smoke) {
      const x = puff.x + puff.dx * puff.age * 26, y = puff.y + puff.dy * puff.age * 26;
      const p = project(x, y, puff.z + puff.age * 35);
      if (puff.age < .16) fx.fillStyle(0xffd485, 1 - puff.age / .16).fillCircle(p.x, p.y, (8 - puff.age * 25) * zoom);
      for (let i = 0; i < 3; i++) fx.fillStyle(0xcbd1ca, (1 - puff.age / 1.1) * .24).fillCircle(p.x + (i - 1) * 4 * zoom, p.y, (4 + puff.age * 13 + i) * zoom);
    }
    for (const e of this.effects) {
      const base = project(e.x, e.y), tip = project(e.x, e.y, Math.sin(e.age / 1.2 * Math.PI) * 48 + (e.damage ? 18 : 0));
      fx.lineStyle(Math.max(1, 3 * zoom), e.damage ? 0xffbd5c : 0xa6ecff, 1 - e.age / 1.2).strokeEllipse(base.x, base.y, (12 + e.age * 50) * zoom, (8 + e.age * 35) * zoom);
      if (!e.damage) fx.lineStyle((7 - e.age * 4) * zoom, 0xc5f2ff, (1 - e.age / 1.2) * .7).lineBetween(base.x, base.y, tip.x, tip.y);
      else fx.fillStyle(e.age < .15 ? 0xffdc8e : 0xbbc6c6, (1 - e.age / 1.2) * .5).fillCircle(tip.x, tip.y - e.age * 20 * zoom, (5 + e.age * 16) * zoom);
    }
    this.damageLabels.forEach((label) => label.destroy()); this.damageLabels = [];
    for (const e of this.effects.filter((e) => e.damage)) {
      const screen = battleToScreen(layout, e);
      this.damageLabels.push(this.add.text(screen.x, screen.y - 20 - e.age * 38, `−${e.damage}`, { fontFamily: font, fontSize: `${Math.max(12, 24 * zoom)}px`, color: '#ffb39b' }).setOrigin(.5).setAlpha(1 - e.age / 1.2));
    }
    if (this.marker) {
      const p = project(this.marker.x, this.marker.y);
      g.lineStyle(2, 0xffe39a, .8).strokeEllipse(p.x, p.y, 32 * zoom, 32 * Math.SQRT1_2 * zoom);
      line(this.marker.x - 24, this.marker.y, this.marker.x + 24, this.marker.y); line(this.marker.x, this.marker.y - 24, this.marker.x, this.marker.y + 24);
    }
    if (this.drag) {
      const end = battleToScreen(layout, this.cursor);
      if (isBattleDrag({ x: this.drag.screenX, y: this.drag.screenY }, end)) g.lineStyle(2, 0xffe5a4).strokeRect(Math.min(this.drag.screenX, end.x), Math.min(this.drag.screenY, end.y), Math.abs(this.drag.screenX - end.x), Math.abs(this.drag.screenY - end.y));
    }
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
    this.buttons.forEach((b, i) => {
      b.setText(names[i]).setPosition(width / 2 + ((i % cols) - (cols - 1) / 2) * Math.min(155, width / cols), height - (width < 650 ? 76 : 53) + Math.floor(i / cols) * 40);
      const background = i >= 1 && i <= 3 && (['column', 'line', 'spread'][i - 1] === this.formation) ? '#725d30' : '#163e54';
      if (b.style.backgroundColor !== background) b.setBackgroundColor(background);
    });
    this.help.setPosition(width / 2, 62).setText(this.sys.game.device.input.touch
      ? text('Tap ship to select · Tap sea to move · Tap enemy to attack', '点击选择 · 点击海面移动 · 点击敌舰攻击')
      : text('Select · Right-click to order / Tap sea to move · Broadside auto-fire', '选择舰船 · 右键下令／点击海面移动 · 侧舷自动开火')).setFontSize(width < 600 ? 10 : 13);
    const outcome = this.session.battle.outcome;
    if (outcome && this.endedAt !== null && this.clock - this.endedAt >= 1.5) {
      const win = outcome === (this.session.side === 'attacker' ? 'victory' : 'defeat');
      const withdrawal = this.session.battle.withdrawal;
      const own = withdrawal?.side === this.session.side;
      const reason = !withdrawal ? '' : withdrawal.reason === 'flagship'
        ? own ? text('Flagship crippled — fleet withdraws', '我方旗舰重伤，舰队撤退') : text('Enemy flagship crippled — fleet withdraws', '敌方旗舰重伤，舰队撤退')
        : withdrawal.reason === 'losses'
          ? own ? text('Half the fleet lost — fleet withdraws', '我方损失半数舰船，舰队撤退') : text('Enemy fleet loses half — withdraws', '敌方损失半数舰船，舰队撤退')
          : own ? text('Your fleet withdraws', '我方舰队撤退') : text('Enemy fleet withdraws', '敌舰队撤退');
      const result = outcome === 'draw' ? text('Draw', '平局') : win ? text('Victory', '胜利') : text('Defeat', '战败');
      this.banner.setPosition(width / 2, height / 2).setFontSize(width < 600 ? 20 : 28).setWordWrapWidth(Math.max(100, width - 80), true).setDepth(3).setText(reason ? `${result}\n${reason}` : result).setVisible(true);
    } else this.banner.setVisible(this.paused).setPosition(width / 2, height / 2).setText(text('Paused', '已暂停'));
  }
}
