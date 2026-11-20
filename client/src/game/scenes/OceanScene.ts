import Phaser from 'phaser';
import { chartIdentity, colonyToll, createDefaultMap, nodeName, WORLD, type GameEvent, type GameState, type MapNode } from '@happy-voyage/shared';
import { getLocale, subscribeLocale } from '../../i18n';
import { readPreference } from '../../ui/accessibilityPreferences';

const REGIONS = [['ATLANTIC OCEAN', '大西洋'], ['THE AMERICAS', '美洲'], ['AFRICA · INDIAN OCEAN', '非洲 · 印度洋'], ['ASIAN SEAS', '亚洲海域']];
const GOLD_REASONS_ZH: Record<string, string> = { salary: '薪俸', promotion: '晋升', royal: '赏赐', colony: '殖民地', captain: '船长', lottery: '彩票', buried: '宝藏', foreign: '税金', merchant: '商船', pirate: '海盗', pirates: '海盗', revival: '修理', scrap: '废料', ship: '船只', storm: '风暴', trade: '交易', treasure: '宝藏', toll: '过路费', tax: '税金', market: '市场', build: '建设' };
import { EventBus } from '../EventBus';
import { gameController } from '../GameController';
import { sfx } from '../sfx';

const HOP_HEIGHT = 10;
const EVENT_SYMBOL: Record<string, string> = { treasure: '$', storm: '!', tradeWind: '≈', pirates: '⚔', smallMonster: 'm', largeMonster: 'M', turtle: 'T', whirlpool: '◎', bottle: '?', floatingCargo: '▣', merchant: '¤', wyvern: 'W' };
const SPECIAL_SYMBOL: Record<string, string> = { skeleton: '☠', treasure: '◆', mist: '☁', revival: '✚', nightless: '☾', wind: '≋', dragonSnake: '♜' };
const PORT_FLAGS: Record<string, [number, number, number]> = {
  Spain: [0xc62632, 0xf6c945, 0xc62632], Netherlands: [0xc62632, 0xffffff, 0x23478e],
  England: [0xffffff, 0xc62632, 0xffffff], Portugal: [0x147549, 0xc62632, 0xc62632],
  China: [0xc62632, 0xc62632, 0xc62632], France: [0x23478e, 0xffffff, 0xc62632],
  Japan: [0xffffff, 0xffffff, 0xffffff], Germany: [0x202020, 0xc62632, 0xf6c945],
  Italy: [0x147549, 0xffffff, 0xc62632], Korea: [0xffffff, 0xffffff, 0xffffff],
};

/** Small offsets so several fleets on one stop don't overlap. */
const TOKEN_OFFSETS = [
  [-14, -16],
  [14, -16],
  [-14, 12],
  [14, 12],
];

/**
 * The sea: animated ocean, the route between stops, colony flags and the
 * fleets. Reads game state from the controller and never changes it; it only
 * reports when a move animation finishes.
 */
export class OceanScene extends Phaser.Scene {
  private map: MapNode[] = createDefaultMap();
  private following = true;
  private pinch: { distance: number; zoom: number } | null = null;
  private ships = new Map<number, Phaser.GameObjects.Image>();
  private colorBlind = false;
  private ocean!: Phaser.GameObjects.Graphics;
  private colonyBadges = new Map<number, Phaser.GameObjects.Text>();
  private shipBadges = new Map<number, Phaser.GameObjects.Text>();
  private flags!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Graphics;
  private labels!: Phaser.GameObjects.Layer;
  private stopLabels = new Map<number, Phaser.GameObjects.Text>();
  private regionLabels: Phaser.GameObjects.Text[] = [];
  /** Fleets whose move is being shown; their sprites are not snapped to the state position. */
  private sailing = new Set<number>();
  private islands = new Map<number, Phaser.GameObjects.Image>();
  private goldPopups = new Map<Phaser.GameObjects.Text, { x: number; y: number; lane: number }>();
  private movement: { playerId: number; path: number[]; id: number; index: number } | null = null;
  private moveTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('Ocean');
  }

  create() {
    this.input.addPointer(1);
    const fit = () => {
      const camera = this.cameras.main;
      camera.setSize(this.game.canvas.parentElement!.clientWidth, this.game.canvas.parentElement!.clientHeight);
      camera.setZoom(Math.min(camera.width / WORLD.width, camera.height / WORLD.height));
      camera.centerOn(WORLD.width / 2, WORLD.height / 2);
      this.following = false;
    };
    fit();
    this.following = this.scale.width < 700;
    if (this.following) this.cameras.main.setZoom(0.95);
    const zoom = (factor: number) => this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * factor, 0.16, 2));
    this.input.on('wheel', (_p: unknown, _o: unknown, _x: number, dy: number) => { zoom(dy > 0 ? 0.9 : 1.1); });
    this.input.on('pointerdown', () => this.updatePinch());
    this.input.on('pointerup', () => { this.pinch = null; });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      this.following = false;
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (a.isDown && b.isDown) {
        return;
      } else {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
    });
    const onFit = () => fit();
    const onFollow = () => { this.following = true; this.cameras.main.setZoom(0.95); this.syncFromState(); };
    const onResize = () => { if (this.scale.width >= 700) fit(); else onFollow(); };
    this.scale.on('resize', onResize);
    EventBus.on('fit-chart', onFit);
    EventBus.on('follow-ship', onFollow);
    this.colorBlind = readPreference('color-blind');
    this.drawOcean();
    this.drawRoute();
    this.labels = this.add.layer();
    this.drawStops();
    // Flags and the turn ring sit above the fleets so a moored ship never hides who owns an island.
    this.flags = this.add.graphics().setDepth(11);
    this.marker = this.add.graphics().setDepth(12);

    const syncLabels = () => {
      const showLabels = getComputedStyle(this.scale.parent).getPropertyValue('--chart-labels').trim() !== 'hidden';
      this.labels.setVisible(showLabels);
    };
    syncLabels();
    this.scale.on(Phaser.Scale.Events.RESIZE, syncLabels);
    const onState = () => this.syncFromState();
    const onMove = (move: { playerId: number; path: number[]; id: number }) => this.animateMove(move);
    const onPacing = () => this.updatePacing();
    const onCancel = () => this.cancelMove();
    const onEngine = (event: GameEvent) => this.onEngineEvent(event);
    const onPalette = (enabled: boolean) => {
      this.colorBlind = enabled;
      this.drawOceanBackground();
      gameController.state?.players.forEach((player) => {
        this.ships.get(player.id)?.setTint(chartIdentity(player, enabled).color);
      });
      this.syncFromState();
    };
    EventBus.on('state-changed', onState);
    EventBus.on('animate-move', onMove);
    const onGold = (event: Extract<GameEvent, { type: 'goldChanged' }>) => this.showGold(event);
    EventBus.on('gold-changed', onGold);
    EventBus.on('pacing-changed', onPacing);
    EventBus.on('cancel-move', onCancel);
    EventBus.on('engine-event', onEngine);
    EventBus.on('palette-changed', onPalette);
    const unsubscribeLocale = subscribeLocale(() => this.relabel(gameController.state));
    const cleanup = () => {
      unsubscribeLocale();
      this.scale.off('resize', onResize);
      EventBus.off('fit-chart', onFit);
      EventBus.off('follow-ship', onFollow);
      this.goldPopups.clear();
      this.scale.off(Phaser.Scale.Events.RESIZE, syncLabels);
      this.cancelMove();
      EventBus.off('state-changed', onState);
      EventBus.off('animate-move', onMove);
      EventBus.off('gold-changed', onGold);
      EventBus.off('pacing-changed', onPacing);
      EventBus.off('cancel-move', onCancel);
      EventBus.off('engine-event', onEngine);
      EventBus.off('palette-changed', onPalette);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);

    this.syncFromState();
    gameController.resumeMovement();
  }

  update() {
    this.updatePinch();
    this.shipBadges.forEach((badge, id) => {
      const ship = this.ships.get(id)!;
      badge.setPosition(ship.x + 12, ship.y - 13);
    });
  }

  private updatePinch() {
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    if (!a.isDown || !b.isDown) { this.pinch = null; return; }
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (distance === 0) return;
    const camera = this.cameras.main;
    if (!this.pinch) this.pinch = { distance, zoom: camera.zoom };
    this.following = false;
    camera.setZoom(Phaser.Math.Clamp(this.pinch.zoom * distance / this.pinch.distance, 0.16, 2));
  }

  private drawOcean() {
    this.ocean = this.add.graphics();
    this.drawOceanBackground();
    this.regionLabels = REGIONS.map(([en, zh], i) =>
      this.add.text(WORLD.width / 2, 24 + i * 280, getLocale() === 'zh' ? zh : en, { fontFamily: '"Sea Names", Georgia, serif', fontSize: '24px', color: '#b8dfdd' }).setOrigin(0.5).setAlpha(0.4));

    // Drifting wave crests.
    for (let i = 0; i < 45; i++) {
      const wave = this.add
        .image(Phaser.Math.Between(0, WORLD.width), Phaser.Math.Between(0, WORLD.height), 'wave')
        .setAlpha(Phaser.Math.FloatBetween(0.3, 0.8))
        .setScale(Phaser.Math.FloatBetween(0.6, 1.2));
      this.tweens.add({
        targets: wave,
        x: wave.x + Phaser.Math.Between(20, 50),
        alpha: 0.1,
        duration: Phaser.Math.Between(2500, 5000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private drawOceanBackground() {
    const [top, bottom] = this.colorBlind ? [0x315574, 0x17273e] : [0x1e88c7, 0x0a3d62];
    this.ocean.clear();
    this.ocean.fillStyle(top);
    this.ocean.fillGradientStyle(top, top, bottom, bottom, 1);
    this.ocean.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  private syncBadge(badges: Map<number, Phaser.GameObjects.Text>, id: number, label: string | null, x: number, y: number, depth: number) {
    const previous = badges.get(id);
    if (label === null) {
      previous?.destroy();
      badges.delete(id);
    } else if (previous) {
      previous.setText(label).setPosition(x, y);
    } else {
      const badge = this.add.text(x, y, label, {
        fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', fontSize: '17px',
        color: '#ffffff', backgroundColor: '#142235', padding: { x: 4, y: 0 },
      }).setOrigin(0.5).setDepth(depth);
      badges.set(id, badge);
    }
  }

  private drawRoute() {
    const g = this.add.graphics();
    g.lineStyle(4, 0xffffff, 0.25);
    this.map.forEach((node, i) => {
      const next = this.map[(i + 1) % this.map.length];
      g.lineBetween(node.x, node.y, next.x, next.y);
      const angle = Math.atan2(next.y - node.y, next.x - node.x);
      const x = (node.x + next.x) / 2;
      const y = (node.y + next.y) / 2;
      g.lineStyle(2, 0xffffff, 0.65);
      for (const side of [-1, 1]) {
        g.lineBetween(x, y, x - 9 * Math.cos(angle) + side * 5 * Math.sin(angle), y - 9 * Math.sin(angle) - side * 5 * Math.cos(angle));
      }
      g.lineStyle(4, 0xffffff, 0.25);
    });
  }

  private drawStops() {
    for (const node of this.map) {
      if (node.kind === 'island') {
        this.islands.set(node.id, this.add.image(node.x, node.y, 'island').setScale(1.2));
      } else if (node.kind === 'port') {
        const g = this.add.graphics();
        const flag = this.add.graphics({ x: 50, y: 27 });
        const nation = node.nation ?? '';
        const stripes = PORT_FLAGS[nation] ?? [0xffffff, 0xffffff, 0xffffff];
        const vertical = ['Portugal', 'France', 'Italy'].includes(nation);
        stripes.forEach((color, i) => {
          flag.fillStyle(color).fillRect(node.x - 21 + (vertical ? i * 14 : 0), node.y - 55 + (vertical ? 0 : i * 8), vertical ? 14 : 42, vertical ? 24 : 8);
        });
        if (nation === 'England') flag.fillStyle(0xc62632).fillRect(node.x - 4, node.y - 55, 8, 24);
        if (nation === 'Japan' || nation === 'Korea') {
          flag.fillStyle(0xc62632).fillCircle(node.x, node.y - 43, 7);
          if (nation === 'Korea') flag.fillStyle(0x23478e).fillCircle(node.x, node.y - 40, 4);
        }
        if (nation === 'China') flag.fillStyle(0xf6c945).fillCircle(node.x - 11, node.y - 48, 4);
        flag.lineStyle(1, 0x06283d).strokeRect(node.x - 21, node.y - 55, 42, 24);
        g.fillStyle(0x8d6e63).fillRoundedRect(node.x - 26, node.y - 22, 52, 44, 8);
        g.fillStyle(0xffd54f).fillRect(node.x - 16, node.y - 12, 32, 24);
        g.fillStyle(0x6d4c41).fillRect(node.x - 5, node.y - 2, 10, 14);
        flag.lineStyle(2, 0x3e2723).lineBetween(node.x - 21, node.y - 55, node.x - 21, node.y - 22);
      } else if (node.kind === 'special') {
        const colors = [0x9c4778, 0xe2b634, 0x8074ae, 0x38a58c, 0x494c9d, 0x41a9bf, 0xc65d42];
        const index = Object.keys(SPECIAL_SYMBOL).indexOf(node.special ?? '');
        this.add.graphics().fillStyle(colors[index] ?? 0xffffff).fillCircle(node.x, node.y, 28).lineStyle(3, 0xffedbe).strokeCircle(node.x, node.y, 28);
        this.add.text(node.x, node.y, SPECIAL_SYMBOL[node.special ?? ''] ?? '★', { fontSize: '26px' }).setOrigin(0.5);
      } else {
        const g = this.add.graphics();
        g.fillStyle(node.event === 'storm' ? 0x37474f : 0xffb300, 0.95).fillCircle(node.x, node.y, 23);
        g.lineStyle(2, 0xffffff, 0.8).strokeCircle(node.x, node.y, 23);
        this.add
          .text(node.x, node.y, EVENT_SYMBOL[node.event ?? ''] ?? '?', { fontSize: '20px', fontStyle: 'bold', color: '#fff' })
          .setOrigin(0.5);
      }

      const text = this.add
        .text(0, 0, this.stopLabel(node, null), {
          fontFamily: '"Sea Names", Georgia, serif',
          fontSize: '19px',
          wordWrap: { width: 146 },
          color: '#ffffff',
          align: 'center',
          stroke: '#06283d',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      text.setPosition(node.x, node.y + 35).setOrigin(0.5, 0);
      this.labels.add(text);
      this.stopLabels.set(node.id, text);
    }
  }

  private stopLabel(node: MapNode, state: GameState | null): string {
    const zh = getLocale() === 'zh';
    const name = nodeName(node, getLocale());
    if (node.kind === 'island') {
      const toll = state ? colonyToll(state, node.id) : node.toll;
      return zh ? `${name}\n${node.price}金 · 过路${toll}金` : `${name}\n${node.price}g · ${toll}g`;
    }
    return zh || !node.chineseName ? name : `${name}\n${node.chineseName}`;
  }

  private relabel(state: GameState | null) {
    this.stopLabels.forEach((text, id) => text.setText(this.stopLabel(this.map[id], state)));
    this.regionLabels.forEach((text, i) => text.setText(REGIONS[i][getLocale() === 'zh' ? 1 : 0]));
  }

  private syncFromState() {
    const state = gameController.state;
    this.relabel(state);
    this.flags.clear();
    this.marker.clear();
    if (!state) {
      for (const badges of [this.colonyBadges, this.shipBadges]) {
        badges.forEach((badge) => badge.destroy());
        badges.clear();
      }
      this.ships.forEach((ship) => ship.destroy());
      this.ships.clear();
      this.sailing.clear();
      return;
    }

    // Colony flags in the owner's colour.
    state.owners.forEach((owner, nodeId) => {
      if (owner === null) {
        this.syncBadge(this.colonyBadges, nodeId, null, 0, 0, 0);
        return;
      }
      const node = this.map[nodeId];
      const { color, badge } = chartIdentity(state.players[owner], this.colorBlind);
      this.flags.lineStyle(10, 0x06283d, 1).strokeCircle(node.x, node.y, 28);
      this.flags.lineStyle(6, color, 1).strokeCircle(node.x, node.y, 28);
      this.flags.lineStyle(2, 0x3e2723).lineBetween(node.x + 10, node.y - 6, node.x + 10, node.y - 30);
      this.flags.fillStyle(color).fillTriangle(node.x + 10, node.y - 30, node.x + 10, node.y - 18, node.x + 26, node.y - 24);
      this.syncBadge(this.colonyBadges, nodeId, badge, node.x + 21, node.y - 27, 13);
    });

    // Fleets.
    for (const player of state.players) {
      const { color, badge } = chartIdentity(player, this.colorBlind);
      let ship = this.ships.get(player.id);
      if (!ship) {
        ship = this.add.image(0, 0, 'ship').setTint(color).setDepth(10);
        this.ships.set(player.id, ship);
      }
      ship.setAlpha(player.bankrupt ? 0.25 : 1);
      if (!this.sailing.has(player.id)) {
        const [x, y] = this.tokenPosition(player.id, player.position);
        ship.setPosition(x, y);
      }
      this.syncBadge(this.shipBadges, player.id, player.bankrupt ? null : badge, ship.x + 12, ship.y - 13, 14);
    }

    // Ring under the fleet whose turn it is.
    const current = this.ships.get(state.currentPlayer);
    if (current && this.following && this.sailing.size === 0) this.cameras.main.centerOn(current.x, current.y);
    if (current && state.phase !== 'gameOver' && this.sailing.size === 0) {
      this.marker.lineStyle(3, 0xffffff, 0.9).strokeCircle(current.x, current.y + 2, 20);
    }
  }

  private cancelMove() {
    this.moveTween?.stop();
    this.moveTween = null;
    this.movement = null;
    this.sailing.clear();
  }

  private animateMove(move: { playerId: number; path: number[]; id: number }) {
    this.cancelMove();
    this.movement = { ...move, index: 0 };
    this.sailing.add(move.playerId);
    this.marker.clear();
    this.nextStep();
  }

  private updatePacing() {
    if (!this.movement) return;
    if (gameController.timings.step === 0) {
      this.moveTween?.stop();
      this.moveTween = null;
      const move = this.movement;
      queueMicrotask(() => {
        if (this.movement === move) this.finishMove();
      });
    } else {
      this.moveTween?.setTimeScale(200 / gameController.timings.step);
    }
  }

  private nextStep() {
    const move = this.movement;
    if (!move) return;
    if (gameController.timings.step === 0 || move.index >= move.path.length) {
      this.updatePacing();
      if (gameController.timings.step !== 0) this.finishMove();
      return;
    }
    const ship = this.ships.get(move.playerId);
    if (!ship) { this.finishMove(); return; }
    const [x, y] = this.tokenPosition(move.playerId, move.path[move.index++]);
    if (this.following) this.cameras.main.pan(x, y, gameController.timings.step);
    this.moveTween = this.hop(ship, x, y, () => {
      if (this.movement !== move) return;
      this.moveTween = null;
      sfx.step();
      this.nextStep();
    });
    this.updatePacing();
  }

  private finishMove() {
    const move = this.movement;
    if (!move) return;
    const destination = move.path[move.path.length - 1];
    if (destination !== undefined) {
      const [x, y] = this.tokenPosition(move.playerId, destination);
      this.ships.get(move.playerId)?.setPosition(x, y);
      if (this.following) this.cameras.main.centerOn(x, y);
    }
    this.cancelMove();
    EventBus.emit('move-complete', move.id);
  }

  /** One step along the route: a little arc, like a ship riding a swell. */
  private hop(ship: Phaser.GameObjects.Image, x: number, y: number, onComplete: () => void): Phaser.Tweens.Tween {
    const fromX = ship.x;
    const fromY = ship.y;
    ship.setFlipX(x < fromX);
    return this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 200,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        ship.setPosition(fromX + (x - fromX) * t, fromY + (y - fromY) * t - Math.sin(Math.PI * t) * HOP_HEIGHT);
      },
      onComplete,
    });
  }

  // --- board effects for engine events --------------------------------------

  private onEngineEvent(event: GameEvent) {
    const state = gameController.state;
    if (!state) return;
    switch (event.type) {
      case 'seaEvent': {
        const ship = this.ships.get(event.playerId);
        if (event.event === 'largeMonster') this.cameras.main.shake(450, 0.009);
        else if (event.event === 'smallMonster') this.cameras.main.shake(180, 0.003);
        else if (event.event === 'turtle') this.cameras.main.shake(350, 0.006);
        if (ship && event.event === 'whirlpool') {
          const swirl = this.add.text(ship.x, ship.y, '◎', { fontSize: '64px', color: '#a1efff' }).setOrigin(0.5).setDepth(30);
          this.tweens.add({ targets: swirl, angle: 360, scale: 2, alpha: 0, duration: 900, onComplete: () => swirl.destroy() });
        }
        if (ship && (event.gold ?? 0) > 0) this.coinBurst(ship.x, ship.y + 30, ship.x, ship.y, 6);
        break;
      }
      case 'tollPaid': {
        const payer = this.ships.get(event.from);
        const island = this.map[state.players[event.from].position];
        if (!payer) break;
        this.coinBurst(payer.x, payer.y, island.x, island.y, 6, () => this.bounce(island.id));
        break;
      }
      case 'claimed': {
        const node = this.map[event.nodeId];
        const { color } = chartIdentity(state.players[event.playerId], this.colorBlind);
        this.bounce(node.id);
        this.confetti(node.x, node.y, color);
        break;
      }
      case 'goldChanged': {
        // The amounts themselves are shown by showGold; this adds the jingle of coins or the jolt of a storm.
        const ship = this.ships.get(event.playerId);
        if (!ship) break;
        if (event.reason === 'royal salary') {
          const home = this.map[state.players[event.playerId].homePort];
          this.coinBurst(home.x, home.y, ship.x, ship.y, 4);
        } else if (event.reason === 'treasure' || event.reason === 'trade') this.coinBurst(ship.x, ship.y + 20, ship.x, ship.y, 4);
        else if (event.reason === 'storm repairs') this.cameras.main.shake(250, 0.004);
        break;
      }
    }
  }

  /** Coins arcing from one point to another; `onArrive` runs when the first lands. */
  private coinBurst(fromX: number, fromY: number, toX: number, toY: number, count: number, onArrive?: () => void) {
    for (let i = 0; i < count; i++) {
      const coin = this.add.image(fromX, fromY, 'coin').setDepth(25);
      const lift = 50 + Math.random() * 30;
      const spread = (Math.random() - 0.5) * 30;
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: i * 60,
        duration: 450,
        ease: 'Quad.easeIn',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          coin.setPosition(fromX + (toX - fromX) * t + spread * Math.sin(Math.PI * t), fromY + (toY - fromY) * t - Math.sin(Math.PI * t) * lift);
        },
        onComplete: () => {
          coin.destroy();
          if (i === 0) onArrive?.();
        },
      });
    }
  }

  private bounce(nodeId: number) {
    const island = this.islands.get(nodeId);
    if (!island) return;
    this.tweens.add({ targets: island, scale: island.scaleX * 1.3, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
  }

  private confetti(x: number, y: number, color: number) {
    const colors = [color, 0xffd54f, 0xffffff];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const bit = this.add.rectangle(x, y, 6, 4, colors[i % colors.length]).setDepth(25);
      this.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * Phaser.Math.Between(40, 70),
        y: y + Math.sin(angle) * Phaser.Math.Between(30, 60),
        angle: Phaser.Math.Between(-360, 360),
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeOut',
        onComplete: () => bit.destroy(),
      });
    }
  }

  private tokenPosition(playerId: number, nodeId: number): [number, number] {
    const node = this.map[nodeId];
    const [dx, dy] = TOKEN_OFFSETS[playerId % TOKEN_OFFSETS.length];
    return [node.x + dx, node.y + dy];
  }

  private showGold({ playerId, delta, reason }: Extract<GameEvent, { type: 'goldChanged' }>) {
    const ship = this.ships.get(playerId);
    if (!ship) return;
    const englishReason = reason.startsWith('royal') ? 'salary' : reason.split(' ')[0];
    const shortReason = getLocale() === 'zh' ? GOLD_REASONS_ZH[englishReason.toLowerCase()] ?? '' : englishReason;
    const angle = Math.atan2(ship.y - WORLD.height / 2 - 10, ship.x - WORLD.width / 2);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nearby = [...this.goldPopups.values()].filter((other) => Math.hypot(other.x - ship.x, other.y - ship.y) < 90);
    let lane = 0;
    while (nearby.some((other) => other.lane === lane)) lane += 1;
    const offset = Math.ceil(lane / 2) * (lane % 2 === 1 ? 110 : -110);
    const popup = this.add.text(0, 0, `${delta < 0 ? '−' : '+'}${Math.abs(delta)}${getLocale() === 'zh' ? '金' : 'g'}${shortReason ? `\n${shortReason}` : ''}`, {
      fontFamily: '"Sea Names", system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold',
      color: delta < 0 ? (this.colorBlind ? '#ffd18a' : '#ff9c9c') : (this.colorBlind ? '#a9deff' : '#9dffb0'),
      align: 'center', stroke: '#06283d', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30);
    const distance = 32 + Math.abs(dx) * popup.width / 2 + Math.abs(dy) * popup.height / 2;
    const clampX = (x: number) => Phaser.Math.Clamp(x, popup.width / 2 + 8, WORLD.width - popup.width / 2 - 8);
    const clampY = (y: number) => Phaser.Math.Clamp(y, popup.height / 2 + 8, WORLD.height - popup.height / 2 - 8);
    popup.setPosition(clampX(ship.x + dx * distance - dy * offset), clampY(ship.y + dy * distance + dx * offset));
    this.goldPopups.set(popup, { x: ship.x, y: ship.y, lane });
    this.tweens.add({
      targets: popup, x: clampX(popup.x + dx * 48), y: clampY(popup.y + dy * 48), alpha: 0, duration: 1800,
      onComplete: () => { this.goldPopups.delete(popup); popup.destroy(); },
    });
  }
}
