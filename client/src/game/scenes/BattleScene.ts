import Phaser from 'phaser';
import { BATTLE_FIELD, TICK, playerName, shipName, type BattleShip, type Formation } from '@happy-voyage/shared';
import { getLocale, pick } from '../../i18n';
import { gameController } from '../GameController';
import { BattleSession } from '../BattleSession';
import { battleNameVisible, battleSelectionText } from '../battleHud';
import { destinationSlots, markerAlpha, selectionPulse, MOVE_MARKER_SECONDS } from '../battleSelection';
import { sfx } from '../sfx';
import { battleShipTexture, broadsideMuzzles, prewarmBattleShips, battleShipModel, shipGrade } from '../battleShipArt';
import { battleLayout, battleToScreen, isBattleDrag, pickBattleShip, placeBattleLabel, screenToBattle, type BattleRect } from '../battleLayout';

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
  private enemyHud!: Phaser.GameObjects.Text;
  private countdown!: Phaser.GameObjects.Text;
  private selectionCard!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Text[] = [];
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private damageLabels: Phaser.GameObjects.Text[] = [];
  private ships = new Map<number, Phaser.GameObjects.Image>();
  private selectionGlows = new Map<number, Phaser.GameObjects.Image>();
  private attackTargets = new Set<number>();
  private selected = new Set<number>();
  private formation: Formation = 'line';
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
  private marker: { x: number; y: number; created: number; slots: { x: number; y: number }[] } | null = null;

  constructor() { super('Battle'); }

  create() {
    const state = gameController.state!;
    this.session = new BattleSession(state.pendingBattle!, state.players);
    this.labels.clear(); this.ships.clear(); this.selected.clear(); this.previous.clear(); this.sunkAt.clear();
    this.selectionGlows.clear(); this.attackTargets.clear();
    this.damageLabels = [];
    this.buttons = []; this.effects = []; this.smoke = []; this.clock = 0; this.endedAt = null; this.completed = false;
    this.accumulator = 0; this.paused = false; this.drag = null; this.marker = null; this.formation = 'line';
    this.cameras.main.setBackgroundColor('#041b2d');
    this.field = this.add.container();
    this.ink = this.add.graphics().setDepth(-10000); this.field.add(this.ink);
    this.actionInk = this.add.graphics().setDepth(.5);
    this.flights = new WeakMap();
    this.hudInk = this.add.graphics().setDepth(2);
    for (const s of this.session.battle.ships) {
      const pending = state.pendingBattle!;
      const owner = s.side === 'attacker' ? pending.attacker : pending.defender;
      const color = owner === null ? 0xc33535 : state.players[owner].color;
      const image = this.add.image(0, 0, battleShipTexture(this, s, color, owner === null));
      this.field.add(image); this.ships.set(s.id, image);
      if (s.side === this.session.side) {
        const glow = this.add.image(0, 0, image.texture.key).setTintFill(0x6ffff1).setVisible(false);
        this.field.add(glow); this.selectionGlows.set(s.id, glow);
      }
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
    this.enemyHud = this.add.text(0, 0, '', style).setOrigin(.5, 0);
    this.countdown = this.add.text(0, 0, '', style).setOrigin(.5);
    this.selectionCard = this.add.text(0, 0, '', { ...style, fontSize: '13px' }).setOrigin(.5, 0);
    [this.hud, this.enemyHud, this.countdown, this.selectionCard].forEach(label => label.setDepth(3));
    this.help = this.add.text(0, 0, '', { ...style, fontSize: '13px', color: '#aed0dd' }).setOrigin(.5, 0);
    this.banner = this.add.text(0, 0, '', { ...style, fontSize: '38px', color: '#ffe6ad' }).setOrigin(.5).setDepth(5).setVisible(false);
    const actions = [
      () => this.selectAll(),
      ...(['column', 'line', 'spread'] as const).map((f) => () => this.changeFormation(f)),
      () => { if (!this.session.battle.outcome) this.paused = !this.paused; },
      () => this.session.command({ type: 'retreat' }),
    ];
    actions.forEach((action) => {
      const b = this.add.text(0, 0, '', { ...style, fontSize: '15px' }).setOrigin(.5).setDepth(3).setInteractive({ useHandCursor: true });
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
      if (['1', '2', '3'].includes(e.key)) this.changeFormation((['column', 'line', 'spread'] as const)[Number(e.key) - 1]);
    };
    this.input.keyboard?.on('keydown', key);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown', key));
  }

  private selectAll() {
    this.selected = new Set(this.session.battle.ships.filter((s) => s.side === this.session.side && !s.sunk && !s.escaped).map((s) => s.id));
    this.syncFormation();
  }

  private syncFormation() {
    const ships = this.session.battle.ships.filter(s => this.selected.has(s.id) && s.side === this.session.side && !s.sunk && !s.escaped);
    const group = this.session.battle.groups.find(g => ships.length && ships.every(s => s.groupId === g.id));
    this.formation = group?.formation ?? this.session.battle.lastFormations[this.session.side];
  }

  private changeFormation(formation: Formation) {
    this.formation = formation;
    this.session.changeFormation([...this.selected], formation);
  }

  private layout() { return battleLayout(this.scale.width, this.scale.height); }
  private point(p: Phaser.Input.Pointer) { return screenToBattle(this.layout(), p); }
  private shipAt(p: { x: number; y: number }) {
    const layout = this.layout(), screen = battleToScreen(layout, p);
    return pickBattleShip(screen, this.session.battle.ships.filter(s => !s.sunk && !s.escaped).map(ship => {
      const image = this.ships.get(ship.id)!;
      return { ship, id: ship.id, x: image.x, y: image.y, depth: image.depth, bounds: image.getBounds(), radius: 38 * layout.zoom * layout.shipScale };
    }))?.ship;
  }

  private order(p: { x: number; y: number }, target?: BattleShip) {
    if (!this.selected.size || this.paused || this.session.battle.outcome) return;
    const shipIds = [...this.selected];
    if (target && target.side !== this.session.side) {
      this.session.command({ type: 'attack', shipIds, targetId: target.id, formation: this.formation });
      this.marker = null;
    }
    else {
      this.session.command({ type: 'move', shipIds, ...p, formation: this.formation });
      this.marker = { ...p, created: this.clock, slots: destinationSlots(this.session.battle, this.session.side, shipIds, p) };
    }
  }

  private pointerDown(p: Phaser.Input.Pointer) {
    const layout = this.layout();
    if (p.y < layout.hudBottom || p.y >= layout.controlsTop || this.session.battle.outcome) return;
    const point = this.point(p);
    const target = this.shipAt(point);
    if (!target && (point.x < 0 || point.x > BATTLE_FIELD.width || point.y < 0 || point.y > BATTLE_FIELD.height)) return;
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
    this.syncFormation();
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
            if (shot) this.smoke.push(...broadsideMuzzles(s, { x: shot.landingX, y: shot.landingY }).map((m) => ({ ...m, x: s.x + (m.x - s.x) * this.layout().shipScale, y: s.y + (m.y - s.y) * this.layout().shipScale, z: m.z * this.layout().shipScale, age: 0 })));
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
    const layout = this.layout(), { zoom, shipScale } = layout;
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
      const x = (i * 193.7 + this.clock * 6) % (BATTLE_FIELD.width - 60) + 20;
      const y = (i * 137.3) % (BATTLE_FIELD.height - 60) + 30 + Math.sin(phase) * 4;
      g.lineStyle((i % 4 ? 1 : 2) * zoom, 0xb1ece6, .06 + (Math.sin(phase) + 1) * .035);
      line(x - 15, y, x - 5, y + 3); line(x - 5, y + 3, x + 6, y + 2); line(x + 6, y + 2, x + 18, y - 1);
    }
    g.lineStyle(2, 0x9cbabe, .5).strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    const state = gameController.state!;
    const pending = state.pendingBattle!;
    const alpha = this.paused || this.session.battle.outcome ? 1 : this.accumulator / TICK;
    const labelBoxes: BattleRect[] = [];
    this.attackTargets.clear();
    for (const group of this.session.battle.groups) {
      if (group.side !== this.session.side) continue;
      if (group.order.type === 'attack') this.attackTargets.add(group.order.targetId);
      if (!group.shipIds.some(id => this.selected.has(id))) continue;
      const leader = this.session.battle.ships.find(s => s.side === group.side && s.id === group.leaderId)!;
      for (const id of group.shipIds) {
        const member = this.session.battle.ships.find(s => s.side === group.side && s.id === id)!;
        g.lineStyle(1, 0x88fff0, .22); line(leader.x, leader.y, member.x, member.y);
      }
    }
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
      const selected = s.side === this.session.side && this.selected.has(s.id) && !s.sunk && !s.escaped;
      const pulse = selectionPulse(this.clock, s.id);
      if (selected) {
        const diameter = Math.max(54, 130 * zoom * shipScale) * pulse.scale;
        g.lineStyle(8, 0x002839, fade * .85).strokeEllipse(screen.x, screen.y, diameter, diameter * Math.SQRT1_2);
        g.lineStyle(4, 0x68fff0, fade * pulse.alpha).strokeEllipse(screen.x, screen.y, diameter, diameter * Math.SQRT1_2);
        g.lineStyle(2, 0xffe278, fade * pulse.alpha).strokeEllipse(screen.x, screen.y, diameter - 9, (diameter - 9) * Math.SQRT1_2);
      }
      if (s.side !== this.session.side && this.attackTargets.has(s.id) && !s.sunk && !s.escaped) {
        const diameter = Math.max(52, 130 * zoom * shipScale);
        g.lineStyle(7, 0x290c13, .9 * fade).strokeEllipse(screen.x, screen.y, diameter, diameter * Math.SQRT1_2);
        g.lineStyle(3, 0xff505b, .95 * fade).strokeEllipse(screen.x, screen.y, diameter, diameter * Math.SQRT1_2);
      }
      if (s.signature) g.lineStyle(2, 0xffd65d, fade).strokeEllipse(screen.x, screen.y, 94 * zoom, 94 * Math.SQRT1_2 * zoom);
      const flash = this.effects.some((e) => e.damage && e.age < .2 && Math.hypot(e.x - s.x, e.y - s.y) < 30);
      const turn = Phaser.Math.Angle.WrapDegrees(s.heading - old.heading);
      const heading = old.heading + turn * alpha + (layout.portrait ? -90 : 0);
      this.ships.get(s.id)!.setTexture(battleShipTexture(this, s, pirate ? 0xc33535 : color, pirate, heading))
        .setPosition(screen.x, screen.y + (s.sunk ? (1 - fade) * 18 * zoom : 0)).setScale(zoom * shipScale / 1.5)
        .setAngle(s.sunk ? (1 - fade) * 20 : 0).setDepth(screen.y).setAlpha(fade).setTint(flash ? 0xff7777 : 0xffffff);
      const glow = this.selectionGlows.get(s.id);
      if (glow) {
        const image = this.ships.get(s.id)!;
        glow.setVisible(selected && fade > 0);
        if (selected) glow.setTexture(image.texture.key).setPosition(image.x, image.y).setOrigin(image.originX, image.originY)
          .setScale(image.scaleX * 1.1).setDepth(screen.y - .1).setAlpha(.5 * pulse.alpha * fade);
      }
      const showName = battleNameVisible(s, this.session.side, this.selected, this.session.battle.ships);
      label.setText(showName ? pirate ? text('Pirate', '海盗') : shipName(s.name, getLocale()) : '');
      const labelSize = Math.max(layout.portrait ? 13 : 11, 19 * zoom);
      label.setFontSize(labelSize);
      const labelColor = selected ? '#fff39b' : '#fff4d5', labelBackground = selected ? '#063c50' : '';
      if (label.style.color !== labelColor) label.setColor(labelColor);
      if (label.style.backgroundColor !== labelBackground) label.setBackgroundColor(labelBackground);
      const wrapWidth = Math.max(1, layout.bounds.width - 12);
      if (label.style.wordWrapWidth !== wrapWidth) label.setWordWrapWidth(wrapWidth, true);
      const barWidth = Math.max(32, 64 * zoom), barHeight = Math.max(4, 7 * zoom);
      const mast = project(x, y, (battleShipModel(this, s.type, shipGrade(s)).mastHeight + 18) * shipScale);
      const nameHeight = showName ? label.height : 0;
      const box = placeBattleLabel(layout.bounds, labelBoxes, { x: mast.x, y: mast.y - nameHeight - barHeight - 8 }, { width: Math.max(label.width, barWidth), height: nameHeight + barHeight + 2 }, 0);
      const labelX = box.x + box.width / 2, labelY = box.y + barHeight + 2;
      if (fade > 0) labelBoxes.push(box);
      label.setPosition(labelX, labelY).setAlpha(fade);
      if (selected && fade > 0) {
        const cy = Math.max(bounds.y + 9, Math.min(mast.y - 12, box.y - 12) + pulse.bob);
        fx.lineStyle(7, 0x032433, fade).beginPath().moveTo(mast.x - 7, cy - 3).lineTo(mast.x, cy + 4).lineTo(mast.x + 7, cy - 3).strokePath();
        fx.lineStyle(3, 0xffec7e, fade * pulse.alpha).beginPath().moveTo(mast.x - 7, cy - 3).lineTo(mast.x, cy + 4).lineTo(mast.x + 7, cy - 3).strokePath();
      }
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
      const shadow = project(b.x, b.y), ball = project(b.x, b.y, 4 * 85 * t * (1 - t) * shipScale);
      fx.fillStyle(0x001926, .45).fillEllipse(shadow.x, shadow.y, 8 * zoom, 5 * zoom);
      fx.fillStyle(0xffefb1).fillCircle(ball.x, ball.y, Math.max(2, 4 * zoom * shipScale));
    }
    for (const puff of this.smoke) {
      const x = puff.x + puff.dx * puff.age * 26, y = puff.y + puff.dy * puff.age * 26;
      const p = project(x, y, puff.z + puff.age * 35);
      if (puff.age < .16) fx.fillStyle(0xffd485, 1 - puff.age / .16).fillCircle(p.x, p.y, (8 - puff.age * 25) * zoom * shipScale);
      for (let i = 0; i < 3; i++) fx.fillStyle(0xcbd1ca, (1 - puff.age / 1.1) * .24).fillCircle(p.x + (i - 1) * 4 * zoom, p.y, (4 + puff.age * 13 + i) * zoom * shipScale);
    }
    for (const e of this.effects) {
      const base = project(e.x, e.y), tip = project(e.x, e.y, (Math.sin(e.age / 1.2 * Math.PI) * 48 + (e.damage ? 18 : 0)) * shipScale);
      fx.lineStyle(Math.max(1, 3 * zoom), e.damage ? 0xffbd5c : 0xa6ecff, 1 - e.age / 1.2).strokeEllipse(base.x, base.y, (12 + e.age * 50) * zoom, (8 + e.age * 35) * zoom);
      if (!e.damage) fx.lineStyle((7 - e.age * 4) * zoom, 0xc5f2ff, (1 - e.age / 1.2) * .7).lineBetween(base.x, base.y, tip.x, tip.y);
      else fx.fillStyle(e.age < .15 ? 0xffdc8e : 0xbbc6c6, (1 - e.age / 1.2) * .5).fillCircle(tip.x, tip.y - e.age * 20 * zoom, (5 + e.age * 16) * zoom);
    }
    this.damageLabels.forEach((label) => label.destroy()); this.damageLabels = [];
    for (const e of this.effects.filter((e) => e.damage)) {
      const screen = battleToScreen(layout, e);
      this.damageLabels.push(this.add.text(screen.x, screen.y - 20 - e.age * 38, `−${e.damage}`, { fontFamily: font, fontSize: `${Math.max(12, 24 * zoom)}px`, color: '#ffb39b' }).setOrigin(.5).setAlpha(1 - e.age / 1.2));
    }
    if (this.marker && this.clock - this.marker.created >= MOVE_MARKER_SECONDS) this.marker = null;
    if (this.marker) {
      const opacity = markerAlpha(this.clock, this.marker.created);
      const p = project(this.marker.x, this.marker.y);
      g.lineStyle(2, 0xffe39a, opacity).strokeEllipse(p.x, p.y, 24, 24 * Math.SQRT1_2);
      line(this.marker.x - 24, this.marker.y, this.marker.x + 24, this.marker.y); line(this.marker.x, this.marker.y - 24, this.marker.x, this.marker.y + 24);
      for (const slot of this.marker.slots) {
        const dot = project(slot.x, slot.y);
        g.fillStyle(0x79fff0, opacity * .35).fillEllipse(dot.x, dot.y, 12, 12 * Math.SQRT1_2);
        g.lineStyle(1, 0xb5fff3, opacity * .7).strokeEllipse(dot.x, dot.y, 12, 12 * Math.SQRT1_2);
      }
    }
    if (this.drag) {
      const end = battleToScreen(layout, this.cursor);
      if (isBattleDrag({ x: this.drag.screenX, y: this.drag.screenY }, end)) g.lineStyle(2, 0xffe5a4).strokeRect(Math.min(this.drag.screenX, end.x), Math.min(this.drag.screenY, end.y), Math.abs(this.drag.screenX - end.x), Math.abs(this.drag.screenY - end.y));
    }
    this.drawHud();
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
      this.banner.setPosition(width / 2, height / 2).setFontSize(width < 600 ? 20 : 28).setText(reason ? `${result}\n${reason}` : result).setVisible(true);
    } else this.banner.setVisible(this.paused).setPosition(width / 2, height / 2).setText(text('Paused', '已暂停'));
    const wrap = Math.max(100, width - 96);
    if (this.banner.style.wordWrapWidth !== wrap) this.banner.setWordWrapWidth(wrap, true);
    if (this.banner.visible) {
      const w = Math.min(width - 24, Math.max(220, this.banner.width + 48)), h = this.banner.height + 64;
      this.hudInk.fillStyle(0x06111a, .65).fillRect(0, layout.hudBottom, width, layout.controlsTop - layout.hudBottom);
      this.panel(this.hudInk, (width - w) / 2, (height - h) / 2, w, h, 0x35251c);
      this.hudInk.lineStyle(1, 0xc9a96b).lineBetween(width / 2 - 42, (height - h) / 2 + 18, width / 2 + 42, (height - h) / 2 + 18);
    }
  }

  private panel(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, color = 0x30251f) {
    g.fillGradientStyle(color, color, 0x191a19, 0x191a19).fillRect(x, y, width, height);
    g.lineStyle(2, 0xb99452).strokeRect(x + 1, y + 1, width - 2, height - 2);
    g.lineStyle(1, 0x665033).strokeRect(x + 4, y + 4, width - 8, height - 8);
    for (const dx of [7, width - 7]) for (const dy of [7, height - 7]) g.fillStyle(0xd7b873).fillCircle(x + dx, y + dy, 1.5);
  }

  private drawHud() {
    const { width, height } = this.scale, layout = this.layout();
    const g = this.hudInk.clear(), state = gameController.state!, pending = state.pendingBattle!;
    const touch = this.sys.game.device.input.touch, compact = width < 650, short = height < 450;
    const bannerWidth = (width - 84) / 2;
    const sides = this.session.side === 'attacker' ? ['attacker', 'defender'] as const : ['defender', 'attacker'] as const;
    sides.forEach((side, index) => {
      const owner = side === 'attacker' ? pending.attacker : pending.defender;
      const color = owner === null ? 0xb93434 : state.players[owner].color;
      const fleet = this.session.battle.ships.filter(s => s.side === side);
      const hp = fleet.reduce((n, s) => n + s.durability, 0), max = fleet.reduce((n, s) => n + s.maxDurability, 0);
      const afloat = fleet.filter(s => !s.sunk && !s.escaped).length, started = fleet.filter(s => s.startedAfloat).length;
      const x = index ? width - bannerWidth - 6 : 6;
      this.panel(g, x, 5, bannerWidth, 60);
      g.fillStyle(color).fillRect(x + 11, 14, 16, 13).lineStyle(1, 0xe4c98b).strokeRect(x + 11, 14, 16, 13);
      g.fillStyle(0x151814).fillRect(x + 12, 51, bannerWidth - 24, 6);
      g.fillStyle(color).fillRect(x + 12, 51, (bannerWidth - 24) * hp / Math.max(1, max), 6);
      const name = owner === null ? text('Pirates', '海盗') : playerName(state.players[owner], getLocale());
      const label = index ? this.enemyHud : this.hud;
      label.setFontSize(compact ? 12 : 15).setPosition(x + bannerWidth / 2 + 7, 12)
        .setText(`${name}\n${afloat}/${started} ${text('ships', '艘')} · ${hp}/${max}`);
    });
    g.fillStyle(0x251e19).fillCircle(width / 2, 35, 29).lineStyle(3, 0xc5a15b).strokeCircle(width / 2, 35, 29);
    g.lineStyle(1, 0x80663b).strokeCircle(width / 2, 35, 24);
    this.countdown.setPosition(width / 2, 35).setFontSize(22).setText(`${Math.max(0, Math.ceil(90 - this.session.battle.tick * TICK))}`);
    const cardY = short ? 69 : 76, cardH = short ? 34 : 52;
    this.panel(g, 6, cardY, width - 12, cardH);
    const selected = this.session.battle.ships.filter(s => this.selected.has(s.id) && s.side === this.session.side && !s.sunk && !s.escaped);
    this.selectionCard.setPosition(width / 2, cardY + (short ? 3 : 7)).setFontSize(short ? 11 : compact ? 12 : 15).setText(battleSelectionText(selected, getLocale()));
    const cols = compact ? 3 : 6, step = Math.min((width - 16) / cols, 170);
    this.panel(g, 0, layout.controlsTop, width, height - layout.controlsTop);
    const names = [text('Fleet', '全舰队'), text('Column', '纵队'), text('Line', '横队'), text('Spread', '散开'), this.paused ? text('Resume', '继续') : text('Pause', '暂停'), text('Retreat', '撤退')];
    this.buttons.forEach((b, i) => {
      const x = width / 2 + (i % cols - cols / 2) * step + 3, y = layout.controlsTop + 6 + Math.floor(i / cols) * 48;
      const active = i === 4 ? this.paused : i > 0 && i < 4 && ['column', 'line', 'spread'][i - 1] === this.formation;
      this.panel(g, x, y, step - 6, 44, i === 5 ? 0x692b22 : active ? 0x81612d : 0x362820);
      const label = names[i] + (touch ? '' : [' [A]', ' [1]', ' [2]', ' [3]', ' [Space]', ''][i]);
      if (b.style.fixedWidth !== step - 6 || b.style.fixedHeight !== 44) b.setFixedSize(step - 6, 44).setPadding(20, 12, 0, 0);
      b.setFontSize(compact ? 13 : 14).setText(label).setPosition(x + (step - 6) / 2, y + 22);
      const ix = x + 15, iy = y + 22;
      g.lineStyle(2, i === 5 ? 0xffaaa0 : active ? 0xffe3a0 : 0xc3ab7c);
      if (i < 4) for (let n = 0; n < 3; n++) {
        const dx = i === 2 ? (n - 1) * 6 : i === 3 ? (n - 1) * 6 : 0;
        const dy = i === 2 ? 0 : (n - 1) * 7;
        g.strokeTriangle(ix + dx, iy + dy - 3, ix + dx - 3, iy + dy + 3, ix + dx + 3, iy + dy + 3);
      }
      else if (i === 4 && !this.paused) g.lineBetween(ix - 4, iy - 7, ix - 4, iy + 7).lineBetween(ix + 4, iy - 7, ix + 4, iy + 7);
      else if (i === 4) g.strokeTriangle(ix - 4, iy - 7, ix + 6, iy, ix - 4, iy + 7);
      else g.lineBetween(ix - 7, iy, ix + 7, iy).lineBetween(ix - 7, iy, ix, iy - 7).lineBetween(ix - 7, iy, ix, iy + 7);
    });
    this.help.setDepth(3).setVisible(!touch && !compact).setPosition(width / 2, height - 12).setFontSize(10)
      .setText(text('Right-click to order · Broadside auto-fire', '右键下令 · 侧舷自动开火'));
  }
}
